// The navigation evidence of an IR-SIM run report, as the Lab shows it: provider from the evidence itself, complete only when nothing says otherwise,
// old reports "unavailable", unknown schemas unsupported, and imported folders verified chunk by chunk (hash fails closed, a missing chunk is incomplete).
import {expect,test,vi} from 'vitest';
vi.hoisted(()=>{(globalThis as Record<string,unknown>).localStorage={getItem:()=>'en',setItem:()=>{}};});
import {navigationEvidenceView,importNavigationEvidence,navigationRows} from '../../src/reports/navigation2d';
import type {RunReport} from '../../src/scenarios/controls';
import {chunks,evidence,project,report} from '../support/navigation-report';
import {reportCsv,reportHtml} from '../../src/reports/metrics';
import {navigationHtml} from '../../src/ui/report-panel';

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
test('review C01 F4: every signal must agree; each disagreement is named (runTick, contradictory completeness, end record, gaps, listings, sensors)',()=>{
 const e=evidence,rec=(r:Record<string,unknown>)=>({...e(),recording:{...e().recording,...r}});
 const cases:[unknown,string[],Record<string,unknown>?][]=[
  [rec({runTick:500}),['EVIDENCE_PENDING']],
  [rec({runTick:300}),['EVIDENCE_AHEAD_OF_CHECKPOINT:301-400']],
  [{...e(),completeness:{status:'complete',reasons:['EVIDENCE_TICKS_MISSING']}},['COMPLETENESS_CONTRADICTORY','EVIDENCE_TICKS_MISSING']],
  [rec({terminal:'WORKER_LOST'}),['EVIDENCE_TERMINAL:WORKER_LOST']],
  [rec({lastTick:399,runTick:399}),['EVIDENCE_END_MISMATCH']],
  [rec({lastTick:399}),['EVIDENCE_END_MISMATCH','EVIDENCE_PENDING']],
  [rec({lastTick:399,terminal:'WORKER_LOST',runTick:399}),['EVIDENCE_TERMINAL:WORKER_LOST','EVIDENCE_END_MISMATCH']],
  [rec({gaps:[{fromTick:10,toTick:12,reason:'DISK_FULL'}]}),['RECORDING_GAP:DISK_FULL']],
  [{...e(),artifacts:{...e().artifacts,control:[e().artifacts.control[0]!]}},['CONTROL_LISTING_GAP']],
  [{...e(),artifacts:{...e().artifacts,sensors:[]}},['SENSOR_LISTING_EMPTY']],
  [e(),['SENSOR_PUBLICATIONS_UNKNOWN'],{metrics:{distanceM:{},collision:{available:false,contacts:null,minSeparationM:null}}}],
 ];
 for(const [n,reasons,over] of cases){const v=navigationEvidenceView(report({navigation2d:n,...over}));expect(v.complete,reasons.join()).toBe(false);expect(v.reasons,reasons.join()).toEqual(reasons);}
 // a run still null before start, or a run tick equal to the last durable tick, says nothing against completeness
 for(const runTick of [null,400])expect(navigationEvidenceView(report({navigation2d:rec({runTick})})).complete).toBe(true);
});
test('review C01 F3: an incomplete view never shows or exports a pass; fails stay fails; reasons travel with the CSV row',()=>{
 const n={...evidence(),completeness:{status:'incomplete',reasons:['EVIDENCE_CHUNK_MISSING:trajectory-000002-abcdef01.ndjson.gz']},assertions:[{id:'EVIDENCE_COVERAGE',result:'pass',detail:'all ticks'},{id:'IR-ARRIVAL',result:'pass',detail:'arrived'},{id:'IR-NO-COLLISION',result:'fail',detail:'contact at 120'},{id:'REPEATABILITY_CROSS_PLATFORM',result:'not_run',detail:'no platform qualified'}]};
 const r=report({navigation2d:n});
 expect(navigationRows(r).map(a=>[a.id,a.result])).toEqual([['EVIDENCE_COVERAGE','unverified'],['IR-ARRIVAL','unverified'],['IR-NO-COLLISION','fail'],['REPEATABILITY_CROSS_PLATFORM','not_run']]);
 const csv=reportCsv(r);expect(csv).not.toMatch(/navigation_assertion.*,pass,/);
 expect(csv).toContain('navigation_assertion,,,,irsim_2d,IR-ARRIVAL,arrived,unverified,EVIDENCE_CHUNK_MISSING:trajectory-000002-abcdef01.ndjson.gz,');
 expect(csv).toContain('navigation_assertion,,,,irsim_2d,IR-NO-COLLISION,contact at 120,fail,,');
 const html=reportHtml(r);expect(html).not.toContain('<td>pass</td>');expect(html).toContain('<td>unverified</td>');
 const panel=navigationHtml(r);expect(panel).not.toContain('data-result="pass"');expect(panel).toContain('data-result="unverified"');expect(panel).toContain('not established');
 expect(navigationRows(report()).map(a=>a.result)).toEqual(['pass','not_run']);// a complete view keeps its passes
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
