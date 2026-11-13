// I2: an answer is applied only to the page state it was asked for. Opening saved evidence and starting replay wait for the page (busy); dropping or
// retargeting the runtime drops the answers still in flight; nothing a completion does renders a page the user has left.
import {afterEach,expect,test,vi} from 'vitest';
vi.stubGlobal('localStorage',{getItem:()=>'en',setItem:()=>{},removeItem:()=>{}});
vi.stubGlobal('innerWidth',600);
vi.stubGlobal('document',{getElementById:()=>null,querySelector:()=>null,activeElement:null,addEventListener(){},removeEventListener(){}});
vi.stubGlobal('location',{origin:'http://127.0.0.1:4175',hostname:'127.0.0.1'});
import type {RunReport,RunView,TwinHealth,TwinRuntime,ReadinessSnapshot} from '../../src/scenarios/controls';
import type {RuntimeTarget} from '../../src/runtime/target';
import {coffeeReplay} from '../support/coffee-replay';
const {TwinWorkspace}=await import('../../src/ui/workspace');
const {presetById}=await import('../../src/scenarios/catalog');
const {captureEvidence}=await import('../../src/reports/evidence');
const workspaces:InstanceType<typeof TwinWorkspace>[]=[];
afterEach(()=>{for(const w of workspaces.splice(0))w.leave();});
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
const health:TwinHealth={protocolMajors:[2],sourceCommit:'d'.repeat(40),schemaHash:'a'.repeat(64),scenarioIds:['BV01'],features:{readiness:true},
 backends:['mock_amr','mock_coffee','mock_arm'].map(id=>({id,modes:['mock'],installed:true,compatible:true,reachable:true,commissioned:true,enabled:true})),backendSets:[{id:'mock-default',mode:'mock',access:'simulated',backends:['mock_amr','mock_coffee','mock_arm']}]};
type H={view:RunView|null;report:RunReport|null;archived:boolean;busy:boolean;readiness:ReadinessSnapshot|null;health:TwinHealth|null;refresh():Promise<void>;checkReadiness():Promise<void>;checkHealth():Promise<void>};
function setup(o:{deferAction?:boolean;deferCreate?:boolean;deferGet?:boolean;deferReadiness?:boolean}={}){
 const {view,report}=coffeeReplay();view.run.status='running';report.outcome={...report.outcome,status:'running',tick:view.tick};
 const saved=coffeeReplay().report;saved.manifest.runId='saved-run';
 const calls:string[]=[],pending:{resolve:(v:never)=>void;kind:string}[]=[];let paired=true;
 const later=<T,>(kind:string,v:T,defer?:boolean):Promise<T>=>{if(!defer)return Promise.resolve(structuredClone(v));const d=deferred<T>();pending.push({resolve:(x:never)=>d.resolve(x===undefined?structuredClone(v):x),kind});return d.promise;};
 const created={...structuredClone(view),run:{...view.run,id:'new-run',status:'ready' as const},tick:0};
 const rt:{target:RuntimeTarget}&Record<string,unknown>={get paired(){return paired;},target:{base:'/lab/v2',kind:'same_origin'} as RuntimeTarget,forget(){paired=false;},retarget(t:RuntimeTarget){rt.target=t;paired=false;calls.push(`retarget ${t.base}`);},
  health:async()=>{calls.push('health');return health;},pair:async()=>{calls.push('pair');paired=true;},
  readiness:(s:string)=>{calls.push(`readiness ${s}`);return later('readiness',{checkedAt:'x',expiresAt:'2099-01-01T00:00:00.000Z',scenarioId:s,backendSetId:'mock-default',checks:[],canStart:true},o.deferReadiness);},
  get:(id:string)=>{calls.push(`get ${id}`);return later('get',view,o.deferGet);},
  report:async(id:string)=>{calls.push(`report ${id}`);return {...structuredClone(report),manifest:{...report.manifest,runId:id}};},
  create:()=>{calls.push('create');return later('create',created,o.deferCreate);},
  action:(v:RunView,kind:string)=>{calls.push(`${kind} ${v.run.id}`);return later(kind,{...structuredClone(v),run:{...v.run,status:'running' as const,runRevision:v.run.runRevision+1},tick:v.tick+250},o.deferAction&&kind==='step');},
 };
 let renders=0;const w=new TwinWorkspace(()=>{renders++;},rt as unknown as TwinRuntime),h=w as unknown as H;workspaces.push(w);
 const preset=presetById('coffee')!;
 Object.assign(h,{view,report,health,healthChecked:true,runPreset:preset,preset,openStreams:()=>{},saved:[{...captureEvidence(saved,preset.project),origin:'imported'}]});
 const evidenceId=(h as unknown as {saved:{id:string}[]}).saved[0]!.id;
 return {w,h,calls,pending,evidenceId,renders:()=>renders};
}
const settle=()=>new Promise(r=>setTimeout(r,0));
test('(1) saved evidence is not opened while a step is in flight; the step lands on the live run it was asked for, and the button says it waits',async()=>{
 const {w,h,pending,evidenceId}=setup({deferAction:true});
 w.click('twin-step');expect(h.busy).toBe(true);
 expect(w.html()).toMatch(/data-action="twin-open-evidence"[^>]*disabled/);
 expect(w.html()).toMatch(/data-action="twin-replay"[^>]*disabled/);
 w.click('twin-open-evidence',evidenceId);w.click('twin-replay');
 expect(h.archived).toBe(false);expect(w.html()).not.toContain('data-testid="recorded-tag"');
 pending.find(p=>p.kind==='step')!.resolve({...h.view!,tick:500} as never);await vi.waitFor(()=>expect(h.busy).toBe(false));
 expect(h.archived).toBe(false);expect(h.view!.run.id).toBe('run');expect(h.report!.manifest.runId).toBe('run');
 // once the page is free, it opens and stays the opened report
 w.click('twin-open-evidence',evidenceId);expect(h.archived).toBe(true);expect(h.report!.manifest.runId).toBe('saved-run');expect(w.html()).toContain('data-testid="recorded-tag"');
});
test('(2) saved evidence is not opened while a create is in flight (refused while busy): the new run is adopted whole, never mixed with an opened report',async()=>{
 const {w,h,pending,evidenceId}=setup({deferCreate:true});Object.assign(h,{view:null,report:null,health:{...health,features:{}}});
 w.click('twin-run');await vi.waitFor(()=>expect(pending.some(p=>p.kind==='create')).toBe(true));
 w.click('twin-open-evidence',evidenceId);expect(h.archived).toBe(false);
 pending.find(p=>p.kind==='create')!.resolve(undefined as never);// the deferred create answers with the created run
 await vi.waitFor(()=>expect(h.busy).toBe(false));
 expect(h.archived).toBe(false);expect(h.view!.run.id).toBe('new-run');expect(h.report!.manifest.runId).toBe('new-run');
});
test('(3) Disconnect, then another address, while a GET run and a readiness check are in flight: the old run does not come back and no request names it',async()=>{
 const {w,h,calls,pending}=setup({deferGet:true,deferReadiness:true});
 void h.refresh();void h.checkReadiness();await settle();expect(pending.map(p=>p.kind).sort()).toEqual(['get','readiness']);
 w.click('twin-disconnect');expect(h.view).toBeNull();
 const mark=calls.length;
 (w as unknown as {connect(a:string,t:string):void}).connect('http://127.0.0.1:4999','code');
 for(const p of pending.splice(0))p.resolve((p.kind==='get'?{...structuredClone(coffeeReplay().view),run:{...coffeeReplay().view.run,status:'running'}}:{checkedAt:'x',expiresAt:'2099-01-01T00:00:00.000Z',scenarioId:'BV01',backendSetId:'mock-default',checks:[],canStart:true}) as never);
 // the new runtime's own readiness check answers too
 await vi.waitFor(()=>{for(const p of pending.splice(0))p.resolve(undefined as never);expect(h.busy).toBe(false);});await settle();
 expect(h.view).toBeNull();expect(h.report).toBeNull();
 expect(calls.slice(mark).filter(c=>/\brun\b/.test(c))).toEqual([]);
 expect(calls.slice(mark)).toContain('retarget http://127.0.0.1:4999/lab/v2');
});
test('(4) a completion that lands after the page was left renders nothing',async()=>{
 const {w,h,pending,renders}=setup({deferGet:true});
 void h.refresh();await settle();w.leave();const n=renders();
 pending[0]!.resolve({...h.view!,run:{...h.view!.run,runRevision:99}} as never);await settle();await settle();
 void h.checkHealth();await settle();await settle();
 expect(renders()).toBe(n);
});
