// The navigation evidence of an IR-SIM run report, as the Lab shows it: provider from the evidence itself, complete only when nothing says otherwise,
// old reports "unavailable", unknown schemas unsupported, and imported folders verified chunk by chunk (hash fails closed, a missing chunk is incomplete).
import {expect,test,vi} from 'vitest';
vi.hoisted(()=>{(globalThis as Record<string,unknown>).localStorage={getItem:()=>'en',setItem:()=>{}};});
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {navigationEvidenceView,importNavigationEvidence,navigationRows} from '../../src/reports/navigation2d';
import type {RunReport} from '../../src/scenarios/controls';
import restaurant from '../../fixtures/twins/restaurant-v2.json' with {type:'json'};
import {hashJson} from '../../src/twin/hash';
import {reportCsv,reportHtml} from '../../src/reports/metrics';

const D=(c:string)=>c.repeat(64),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const chunk=(stream:string,n:number,lines:string[])=>{const bytes=gzipSync(lines.join('\n')+'\n');return {path:`${stream}-${String(n).padStart(6,'0')}-abcdef01.ndjson.gz`,bytes,ref:(first:number,last:number)=>({path:`${stream}-${String(n).padStart(6,'0')}-abcdef01.ndjson.gz`,sha256:sha(bytes),bytes:bytes.length,firstTick:first,lastTick:last})};};
const chunks={trajectory:[chunk('trajectory',1,['{"t":0}']),chunk('trajectory',2,['{"t":250}'])],control:[chunk('control',1,['{"t":0}']),chunk('control',2,['{"t":250}'])],sensors:[chunk('sensors',1,['{"t":0}']),chunk('sensors',2,['{"t":250}'])],collisions:[] as ReturnType<typeof chunk>[]};
export function evidence(){
 return {schemaVersion:1,documentType:'navigation-run-evidence',runId:'11111111-1111-4111-8111-111111111111',sceneDigest:D('a'),sceneRef:{path:'bundle/navigation-scene.json',sha256:D('a'),bytes:10},modelDigests:[D('b')],policyRef:{id:'irsim-2d-default-v1',revision:1,hash:D('c')},
  controller:{id:'grid-diff-v1',version:'1'},engine:{id:'irsim_2d',version:'2.12.0',pythonVersion:'3.11.9',platform:'darwin-arm64',lockDigest:D('d')},clock:{tickMs:20,tickHorizon:400,businessEpochMs:Date.parse('2026-11-01T00:00:00Z')},
  seed:{runSeed:5,engineSeed:9,engineSeedAlgorithm:'irsim-env-seed-v1',sensorSeeds:[],actorRng:{algorithm:'xoshiro128**',seed:5}},validationReportRef:null,
  artifacts:{trajectory:[chunks.trajectory[0]!.ref(0,249),chunks.trajectory[1]!.ref(250,400)],control:[chunks.control[0]!.ref(0,249),chunks.control[1]!.ref(250,399)],sensors:[chunks.sensors[0]!.ref(0,245),chunks.sensors[1]!.ref(250,400)],collisions:[]},
  digests:{trajectoryDigest:D('e'),sensorDigest:D('f'),assertionDigest:D('0'),algorithm:'navigation-evidence-digest-v1'},
  assertions:[{id:'IR-ARRIVAL',result:'pass',detail:'arrived'},{id:'REPEATABILITY_CROSS_PLATFORM',result:'not_run',detail:'no platform qualified'}],
  metricCoverage:[{metric:'collision',status:'available',reason:null}],recordingGaps:[],limitations:['planar kinematic plant'],completeness:{status:'complete',reasons:[]},recording:{gaps:[],terminal:null,lastTick:400,runTick:400}};
}
const project=restaurant.project;
export function report(over:Record<string,unknown>={}):RunReport{
 return {manifest:{runId:'11111111-1111-4111-8111-111111111111',sourceCommit:'s'.repeat(40),mode:'simulation',access:'simulated',backendSetId:'engineering-irsim-2d-v1',backends:[{id:'irsim_2d',version:'2.12.0',model:'irsim',dynamics:false}],clock:{tickMs:20},seed:5,
  scenario:{id:'IR-FD01',revision:1,hash:'h'},project:{id:project.id,revision:project.revision,hash:hashJson(project)},world:{id:project.world.id,revision:project.world.revision,hash:hashJson(project.world)},assets:[]},
  outcome:{status:'completed',served:'1',tick:400,simTimeNs:'8000000000'},metrics:{distanceM:{'amr-1':4},collision:{available:true,contacts:0,minSeparationM:null},navigation:{sensorPublications:{expected:81,recorded:81,complete:true}}} as never,
  businessEvents:[],effects:[],faults:[],reconciliations:[],coverage:{},limitations:[],navigation2d:evidence(),...over} as unknown as RunReport;
}
const files=(r:RunReport,drop?:string)=>{
 const all=[...chunks.trajectory,...chunks.control,...chunks.sensors].filter(c=>c.path!==drop).map(c=>new File([c.bytes as BlobPart],c.path));
 return [new File([JSON.stringify(r)],'report.json'),new File([JSON.stringify(project)],'project.json'),...all];
};

test('a complete IR-SIM report: provider irsim_2d from the evidence, complete, assertions kept with their own results',()=>{
 const view=navigationEvidenceView(report());
 expect(view.provider).toBe('irsim_2d');expect(view.supported).toBe(true);expect(view.complete).toBe(true);expect(view.reasons).toEqual([]);
 expect(navigationRows(report()).map(r=>[r.id,r.result])).toEqual([['IR-ARRIVAL','pass'],['REPEATABILITY_CROSS_PLATFORM','not_run']]);
});
test('old or foreign reports: absent evidence is unsupported, an unknown schema is unsupported, neither shows a provider',()=>{
 const old=report();delete (old as {navigation2d?:unknown}).navigation2d;
 expect(navigationEvidenceView(old)).toEqual({supported:false,provider:null,complete:false,reasons:['NAVIGATION_EVIDENCE_ABSENT']});
 for(const bad of [{...evidence(),schemaVersion:2},{...evidence(),documentType:'other'},{...evidence(),engine:{...evidence().engine,id:'mock_amr'}},{...evidence(),extra:true}])
  expect(navigationEvidenceView(report({navigation2d:bad}))).toMatchObject({supported:false,provider:null,complete:false,reasons:['NAVIGATION_EVIDENCE_SCHEMA_UNKNOWN']});
});
test('incomplete evidence is never complete: server verdict, missing end record, recording gaps, sensor publications, a hole in the listing',()=>{
 const cases:[unknown,string][]=[
  [{...evidence(),completeness:{status:'incomplete',reasons:['EVIDENCE_PENDING']}},'EVIDENCE_PENDING'],
  [(()=>{const e=evidence() as Record<string,unknown>;delete e.completeness;return e;})(),'COMPLETENESS_UNKNOWN'],
  [(()=>{const e=evidence() as Record<string,unknown>;delete e.recording;return e;})(),'EVIDENCE_END_UNKNOWN'],
  [{...evidence(),recordingGaps:[{fromTick:100,toTick:100,reason:'STEP_ACK_LOST'}]},'RECORDING_GAP:STEP_ACK_LOST'],
  [{...evidence(),artifacts:{...evidence().artifacts,trajectory:[evidence().artifacts.trajectory[1]!]}},'TRAJECTORY_LISTING_GAP'],
 ];
 for(const [n,reason] of cases){const v=navigationEvidenceView(report({navigation2d:n}));expect(v.complete,reason).toBe(false);expect(v.reasons,reason).toContain(reason);}
 const pubs=navigationEvidenceView(report({metrics:{distanceM:{},collision:{available:false,contacts:null,minSeparationM:null},navigation:{sensorPublications:{expected:81,recorded:40,complete:false}}}}));
 expect(pubs.complete).toBe(false);expect(pubs.reasons).toContain('SENSOR_PUBLICATIONS_INCOMPLETE');
});
test('import: a folder with every chunk verifies; a missing scan chunk imports as incomplete; a changed chunk or unknown schema is refused',async()=>{
 const ok=await importNavigationEvidence(files(report()));
 expect(ok.origin).toBe('imported');expect(navigationEvidenceView(ok.report).complete).toBe(true);
 const view=navigationEvidenceView((await importNavigationEvidence(files(report(),chunks.sensors[1]!.path))).report);
 expect(view.complete).toBe(false); // imported report with a missing scan chunk
 expect(view.reasons).toContain(`EVIDENCE_CHUNK_MISSING:${chunks.sensors[1]!.path}`);
 const tampered=files(report());tampered[3]=new File([new Uint8Array(chunks.trajectory[1]!.bytes.length)],chunks.trajectory[1]!.path);
 await expect(importNavigationEvidence(tampered)).rejects.toThrow('ARTIFACT_HASH_MISMATCH');
 await expect(importNavigationEvidence(files(report({navigation2d:{...evidence(),schemaVersion:9}})))).rejects.toThrow('NAVIGATION_EVIDENCE_SCHEMA_UNKNOWN');
 const traversal=report();(traversal.navigation2d!.artifacts.sensors[0] as {path:string}).path='../x.ndjson.gz';
 await expect(importNavigationEvidence(files(traversal))).rejects.toThrow(/NAVIGATION_EVIDENCE_SCHEMA_UNKNOWN|ARTIFACT_PATH_INVALID/);
});
test('exports keep each assertion with its own result and say what the evidence is not',()=>{
 const r=report({telemetry:{lossy:true,coalesced:true,rateHz:5,source:'irsim',samples:[],sampleCounts:{},dropped:0,gaps:[]}});
 expect(reportCsv(r)).toContain('navigation_assertion,,,,irsim_2d,REPEATABILITY_CROSS_PLATFORM,no platform qualified,not_run');
 const html=reportHtml(r);expect(html).toContain('Navigation evidence (IR-SIM 2D)');expect(html).toContain('irsim_2d · complete');expect(html).toContain('not Gazebo, native or hardware evidence');
 const old=report();delete (old as {navigation2d?:unknown}).navigation2d;expect(reportHtml({...old,telemetry:r.telemetry} as RunReport)).not.toContain('Navigation evidence');
});
