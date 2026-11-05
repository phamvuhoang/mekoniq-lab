// A/B comparison of two v2 run reports (CORE-10, UX-10): compatibility reasons first, then KPIs with unit, definition and population.
// Runs on different evidence scales (mode/access/backends/fidelity) or scenarios are not ranked: their deltas are null.
// TODO(interim-copy): same logic as source packages/lab-runtime/src/v2/comparison.ts (tests/unit/report-replay.test.ts covers it here); import from the pinned artifact (F07).
import type {RunReport} from '../scenarios/controls';
export interface Kpi {id:string;unit:string;definition:string;value:number|null;available:boolean;reason?:string;samples:number}
const ms=(iso:string)=>Date.parse(iso);
/** KPIs read from one report. Missing data is unavailable with a reason, never 0. */
export function reportKpis(r:RunReport):Kpi[]{
 const ev=r.businessEvents,first=ev.find(e=>e.type==='RobotCommandIssued'),done=[...ev].reverse().find(e=>e.type==='MissionCompleted');
 const execute=r.effects.filter(e=>e.type==='robot.execute');
 let wait=0,arrived:number|null=null,waits=0;
 for(const e of ev){if(e.type==='MissionArrived')arrived=ms(e.at);else if(['CargoLoaded','DeliveryHandedOff','CargoReturned'].includes(e.type)&&arrived!==null){wait+=ms(e.at)-arrived;arrived=null;waits++;}}
 const c=r.metrics.collision,d=Object.values(r.metrics.distanceM);
 const k=(id:string,unit:string,definition:string,value:number|null,samples:number,reason?:string):Kpi=>({id,unit,definition,value,available:value!==null,...value===null?{reason:reason??'NO_DATA'}:{},samples});
 return [
  k('served','count','Units served after the final handoff confirmation (source fulfillment), not after arrival or brew completion.',Number(r.outcome.served),1),
  k('missionTimeS','s','Sim time from the first RobotCommandIssued to the last MissionCompleted, from journal timestamps (virtual clock).',first&&done?(ms(done.at)-ms(first.at))/1000:null,first&&done?1:0,first?'MISSION_NOT_COMPLETED':'NO_ROBOT_COMMAND'),
  k('humanWaitS','s','Sim time robots waited at a stop between MissionArrived and the confirmed load/handoff/return (CargoLoaded, DeliveryHandedOff, CargoReturned), summed.',waits?wait/1000:null,waits,'NO_CONFIRMED_STOP'),
  k('distanceM','m','Path length travelled by all robots in the model (mock_kinematic grid path), summed.',d.length?d.reduce((a,b)=>a+b,0):null,d.length,'NO_ROBOT'),
  k('executeAttempts','count','robot.execute dispatch attempts from the source outbox (no resend after unknown).',execute.reduce((n,e)=>n+e.attempts,0),execute.length),
  k('contacts','count','Contacts between robot footprint and the world in the model; needs resolved geometry.',c.available?c.contacts:null,c.available?1:0,c.reason),
  k('minSeparationM','m','Minimum footprint separation between robots in the model; needs resolved geometry and two robots.',c.available?c.minSeparationM:null,c.available&&c.minSeparationM!==null?1:0,c.reason??'SINGLE_ROBOT'),
 ];
}
const key=(b:RunReport['manifest']['backends'])=>JSON.stringify([...b].map(x=>[x.id,x.version,x.model,x.dynamics]).sort());
/** Evidence-scale flags: two runs whose coverage differs on these are not on the same scale. */
const FIDELITY=['businessSimulation','kinematicModel','dynamics','nativeExecution','physicalStop','sensorEvidence'];
export function compareRuns(a:RunReport,b:RunReport){
 const ma=a.manifest,mb=b.manifest,reasons:string[]=[];
 if(ma.mode!==mb.mode)reasons.push('MODE_DIFFERS');
 if(ma.access!==mb.access)reasons.push('ACCESS_DIFFERS');
 if(ma.scenario.id!==mb.scenario.id||ma.scenario.revision!==mb.scenario.revision||ma.scenario.hash!==mb.scenario.hash)reasons.push('SCENARIO_DIFFERS');
 if(key(ma.backends)!==key(mb.backends))reasons.push('BACKENDS_DIFFER');
 if(ma.clock.tickMs!==mb.clock.tickMs)reasons.push('CLOCK_DIFFERS');
 if(FIDELITY.some(f=>!!a.coverage[f]!==!!b.coverage[f]))reasons.push('FIDELITY_DIFFERS');
 const comparable=!reasons.length;
 // changed inputs are shown, not judged: a layout or seed change is what an A/B compare is for
 const inputs=[['seed',ma.seed,mb.seed],['project.hash',ma.project.hash,mb.project.hash],['world.hash',ma.world.hash,mb.world.hash],['scenario',`${ma.scenario.id} r${ma.scenario.revision}`,`${mb.scenario.id} r${mb.scenario.revision}`],
  ['backendSetId',ma.backendSetId,mb.backendSetId],['sourceCommit',ma.sourceCommit,mb.sourceCommit],['assets',JSON.stringify(ma.assets),JSON.stringify(mb.assets)]]
  .filter(([,x,y])=>x!==y).map(([field,x,y])=>({field:field as string,a:x as string|number,b:y as string|number}));
 const ka=reportKpis(a),kb=reportKpis(b);
 const kpis=ka.map((x,i)=>{const y=kb[i]!,available=x.available&&y.available;
  return {id:x.id,unit:x.unit,definition:x.definition,a:x.value,b:y.value,available,reasons:[x.reason,y.reason].filter(Boolean) as string[],
   delta:comparable&&available?y.value!-x.value!:null,population:{runs:1,samplesA:x.samples,samplesB:y.samples},percentiles:null as null};});
 const coverage=[...new Set([...Object.keys(a.coverage),...Object.keys(b.coverage)])].map(k=>({key:k,a:!!a.coverage[k],b:!!b.coverage[k]}));
 const pop=(r:RunReport)=>({runs:1,businessEvents:r.businessEvents.length,telemetrySamples:r.telemetry?.samples.length??0,telemetryDropped:r.telemetry?.dropped??0});
 return {comparable,reasons,inputs,kpis,coverage,population:{a:pop(a),b:pop(b)},note:'One run per side: no p50/p95. Repeat with seeds for a distribution.'};
}
