// An IR-SIM run report with complete navigation-run-evidence-v1 and its gzip chunks (shared by the report and workspace tests).
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import type {RunReport} from '../../src/scenarios/controls';
import restaurant from '../../fixtures/twins/restaurant-v2.json' with {type:'json'};
import {hashJson} from '../../src/twin/hash';

export const D=(c:string)=>c.repeat(64),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const chunk=(stream:string,n:number,lines:string[])=>{const bytes=gzipSync(lines.join('\n')+'\n');return {path:`${stream}-${String(n).padStart(6,'0')}-abcdef01.ndjson.gz`,bytes,ref:(first:number,last:number)=>({path:`${stream}-${String(n).padStart(6,'0')}-abcdef01.ndjson.gz`,sha256:sha(bytes),bytes:bytes.length,firstTick:first,lastTick:last})};};
export const chunks={trajectory:[chunk('trajectory',1,['{"t":0}']),chunk('trajectory',2,['{"t":250}'])],control:[chunk('control',1,['{"t":0}']),chunk('control',2,['{"t":250}'])],sensors:[chunk('sensors',1,['{"t":0}']),chunk('sensors',2,['{"t":250}'])],collisions:[] as ReturnType<typeof chunk>[]};
export function evidence(){
 return {schemaVersion:1,documentType:'navigation-run-evidence',runId:'11111111-1111-4111-8111-111111111111',sceneDigest:D('a'),sceneRef:{path:'bundle/navigation-scene.json',sha256:D('a'),bytes:10},modelDigests:[D('b')],policyRef:{id:'irsim-2d-default-v1',revision:1,hash:D('c')},
  controller:{id:'grid-diff-v1',version:'1'},engine:{id:'irsim_2d',version:'2.12.0',pythonVersion:'3.11.9',platform:'darwin-arm64',lockDigest:D('d')},clock:{tickMs:20,tickHorizon:400,businessEpochMs:Date.parse('2026-11-01T00:00:00Z')},
  seed:{runSeed:5,engineSeed:9,engineSeedAlgorithm:'irsim-env-seed-v1',sensorSeeds:[],actorRng:{algorithm:'xoshiro128**',seed:5}},validationReportRef:null,
  artifacts:{trajectory:[chunks.trajectory[0]!.ref(0,249),chunks.trajectory[1]!.ref(250,400)],control:[chunks.control[0]!.ref(0,249),chunks.control[1]!.ref(250,399)],sensors:[chunks.sensors[0]!.ref(0,245),chunks.sensors[1]!.ref(250,400)],collisions:[]},
  digests:{trajectoryDigest:D('e'),sensorDigest:D('f'),assertionDigest:D('0'),algorithm:'navigation-evidence-digest-v1'},
  assertions:[{id:'IR-ARRIVAL',result:'pass',detail:'arrived'},{id:'REPEATABILITY_CROSS_PLATFORM',result:'not_run',detail:'no platform qualified'}],
  metricCoverage:[{metric:'collision',status:'available',reason:null}],recordingGaps:[],limitations:['planar kinematic plant'],completeness:{status:'complete',reasons:[]},recording:{gaps:[],terminal:null,lastTick:400,runTick:400}};
}
export const project=restaurant.project;
export function report(over:Record<string,unknown>={}):RunReport{
 return {manifest:{runId:'11111111-1111-4111-8111-111111111111',sourceCommit:'s'.repeat(40),mode:'simulation',access:'simulated',backendSetId:'engineering-irsim-2d-v1',backends:[{id:'irsim_2d',version:'2.12.0',model:'irsim',dynamics:false}],clock:{tickMs:20},seed:5,
  scenario:{id:'IR-FD01',revision:1,hash:'h'},project:{id:project.id,revision:project.revision,hash:hashJson(project)},world:{id:project.world.id,revision:project.world.revision,hash:hashJson(project.world)},assets:[]},
  outcome:{status:'completed',served:'1',tick:400,simTimeNs:'8000000000'},metrics:{distanceM:{'amr-1':4},collision:{available:true,contacts:0,minSeparationM:null},navigation:{sensorPublications:{expected:81,recorded:81,complete:true}}} as never,
  businessEvents:[],effects:[],faults:[],reconciliations:[],coverage:{},limitations:[],navigation2d:evidence(),...over} as unknown as RunReport;
}
