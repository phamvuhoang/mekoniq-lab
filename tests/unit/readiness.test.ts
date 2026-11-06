import {expect,test,vi} from 'vitest';
vi.stubGlobal('localStorage',{getItem:()=>'en',setItem:()=>{}});
const {preflight,ready}=await import('../../src/scenarios/preflight');
const {presetById}=await import('../../src/scenarios/catalog');
const p=presetById('coffee')!;
const health={protocolMajors:[2],sourceCommit:'a'.repeat(40),schemaHash:'b'.repeat(64),scenarioIds:['BV01'],features:{readiness:true},backendSets:[{id:'mock-default',mode:'mock',access:'simulated',backends:['mock_amr','mock_coffee','mock_arm']}],backends:['mock_amr','mock_coffee','mock_arm'].map(id=>({id,modes:['mock'],installed:true,compatible:true,reachable:true,commissioned:true,enabled:true}))};
const snapshot={checkedAt:'2026-11-06T00:00:00Z',expiresAt:'2026-11-06T00:00:30Z',scenarioId:'BV01',backendSetId:'mock-default',checks:[{id:'runner',status:'ready' as const,reasonCodes:[],evidenceRef:null}],canStart:true};
const now=Date.parse('2026-11-06T00:00:10Z');
test('an advertised readiness API must answer before Start becomes available',()=>{expect(ready(preflight(p,health,true,null,now))).toBe(false);});
test('expired readiness and a response for another scenario cannot authorize Start',()=>{
 expect(ready(preflight(p,health,true,snapshot,now))).toBe(true);
 expect(ready(preflight(p,health,true,snapshot,now+30000))).toBe(false);
 expect(ready(preflight(p,health,true,{...snapshot,scenarioId:'FD01'},now))).toBe(false);
});
test('readiness explains unavailable probes rather than hiding them behind health',()=>{
 const checks=preflight(p,health,true,{...snapshot,canStart:false,checks:[{id:'probe:world',status:'blocked',reasonCodes:['WORLD_REVISION_MISMATCH'],evidenceRef:null}]},now);
 expect(checks.find(c=>c.id==='readiness')).toMatchObject({ok:false,detail:expect.stringContaining('WORLD_REVISION_MISMATCH')});
});
test('support matrix never calls an enabled but unreachable provider available',async()=>{
 const {supportMatrix}=await import('../../src/scenarios/support');
 const rows=supportMatrix({...health,backends:health.backends.map(b=>b.id==='mock_arm'?{...b,reachable:false}:b)},{schemaVersion:1,id:'coffee',revision:1,title:'Coffee',scenarios:[{id:'BV01',seed:1,repeat:1,mock:{backendSetId:'mock-default'},simulation:{backendSetId:'coffee-simulation',requires:['linuxcnc_sim']}}]});
 expect(rows.find(r=>r.mode==='mock')).toMatchObject({status:'unavailable',reasons:expect.arrayContaining(['BACKEND_UNREACHABLE:mock_arm'])});
});
