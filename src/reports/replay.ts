// Read-only replay of a v2 run report: scrub/playback over recorded business events (durable) and telemetry (lossy), and a causal trace
// command -> observation -> business transition. No runtime client is imported here: replay cannot send anything.
import type {RunReport} from '../scenarios/controls';
import type {TwinSample} from '../twin/store';
type Event=RunReport['businessEvents'][number];
export interface TraceRow {tick:number;layer:'command'|'observation'|'business'|'effect'|'telemetry';type:string;id:string;entityId?:string;sequence?:string;detail?:string}
const COMMAND=/^(RobotCommandIssued|RobotGoalAssigned|CellCommandIssued|Coffee(StepStarted|JobStarted)|CupTransferRequested)$/;
const OBSERVATION=/(Observed|^RobotGoal(Accepted|Completed|Failed|Rejected)$|^MissionArrived$|Measured$|CupObserved|DeviceObserved|TransferConfirmed)/;
export function openReplayV2(report:RunReport,o:{maxGapTicks?:number}={}){
 const tickMs=report.manifest.clock.tickMs,samples=[...report.telemetry?.samples??[]].sort((a,b)=>Number(a.seq)-Number(b.seq)),gaps=report.telemetry?.gaps??[];
 // virtual-clock origin: a telemetry sample carries both its sim time and the sim-mapped wall time; otherwise the first event is tick 0
 const s0=samples.find(s=>s.observedAt&&s.simTimeNs!==null);
 const epoch=s0?Date.parse(s0.observedAt!)-Number(BigInt(s0.simTimeNs!)/1000000n):report.businessEvents.length?Date.parse(report.businessEvents[0]!.at):0;
 const tickOf=(e:Event)=>Math.round((Date.parse(e.at)-epoch)/tickMs);
 const events=report.businessEvents.map(e=>({...structuredClone(e),tick:tickOf(e)}));
 const toTick=Math.max(report.outcome.tick,...events.map(e=>e.tick),...samples.map(s=>Number(s.seq)));
 // ponytail: default max interpolation gap = 2 recording periods (10 ticks at 10 Hz); a profile value belongs in the manifest when one exists
 const maxGap=o.maxGapTicks??10,tickOfSample=(s:TwinSample)=>Number(BigInt(s.simTimeNs??'0')/BigInt(tickMs*1000000));
 const clamp=(t:number)=>{if(!Number.isFinite(t))throw new Error('INVALID_REPLAY_CURSOR');return Math.max(0,Math.min(Math.round(t),toTick));};
 const byEntity=new Map<string,TwinSample[]>();for(const s of samples)byEntity.set(s.entityId,[...byEntity.get(s.entityId)??[],s]);
 const pose=(entityId:string,tick:number)=>{
  const list=(byEntity.get(entityId)??[]).filter(s=>s.quality==='valid'&&s.observed&&typeof s.observed.xM==='number');
  const i=list.findIndex(s=>tickOfSample(s)>tick),before=i<0?list.at(-1):list[i-1],after=i<0?undefined:list[i];
  if(!before)return null;
  const p=(s:TwinSample)=>({x:s.observed!.xM as number,y:s.observed!.yM as number,yawRad:s.observed!.yawRad as number});
  const tb=tickOfSample(before);if(tb===tick||!after)return {...p(before),interpolated:false,gap:!after&&tick-tb>maxGap,epochChange:false,seq:before.seq};
  const ta=tickOfSample(after);
  // never blend across a boot change or a hole wider than the declared gap: hold the last recorded value and say so
  if(after.bootId!==before.bootId)return {...p(before),interpolated:false,gap:false,epochChange:true,seq:before.seq};
  if(ta-tb>maxGap)return {...p(before),interpolated:false,gap:true,epochChange:false,seq:before.seq};
  const f=(tick-tb)/(ta-tb),a=p(before),b=p(after);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,yawRad:a.yawRad+Math.atan2(Math.sin(b.yawRad-a.yawRad),Math.cos(b.yawRad-a.yawRad))*f,interpolated:true,gap:false,epochChange:false,seq:before.seq};
 };
 return {
  range:{fromTick:0,toTick,tickMs},
  /** Recorded state at a cursor: business events up to it, latest sample per entity, telemetry gaps that cover it. */
  seek(t:number){
   const tick=clamp(t),entities:Record<string,TwinSample>={};
   for(const [id,list] of byEntity){const last=list.filter(s=>tickOfSample(s)<=tick).at(-1);if(last)entities[id]=structuredClone(last);}
   return {tick,simTimeNs:String(BigInt(tick)*BigInt(tickMs)*1000000n),events:structuredClone(events.filter(e=>e.tick<=tick)),entities,gaps:gaps.filter(g=>(g.fromTick??-Infinity)<=tick&&tick<=g.toTick)};
  },
  pose:(entityId:string,t:number)=>t<0?null:pose(entityId,clamp(t)),
  /** Every recorded fact that names `id` (command, mission, job, robot), oldest first, layered command/observation/business/effect/telemetry. */
  trace(id:string):TraceRow[]{
   const names=(x:unknown)=>JSON.stringify(x).includes(JSON.stringify(id));
   const rows:TraceRow[]=events.filter(e=>e.id===id||names(e.state??{})).map(e=>({tick:e.tick,layer:COMMAND.test(e.type)?'command':OBSERVATION.test(e.type)?'observation':'business',type:e.type,id:e.id,sequence:e.sequence}));
   for(const f of report.effects??[])if(names(f.payload)){const cmd=String(f.payload.commandId??''),issued=events.find(e=>e.id===cmd&&COMMAND.test(e.type));rows.push({tick:issued?.tick??0,layer:'effect',type:f.type,id:f.id,detail:`${f.status} · attempts ${f.attempts}`});}
   const sample=samples.find(s=>s.causationId===id||s.entityId===id);
   if(sample)rows.push({tick:tickOfSample(sample),layer:'telemetry',type:'TwinSample',id:`${sample.entityId}#${sample.seq}`,entityId:sample.entityId,detail:`${sample.quality} · ${sample.bootId}`});
   return rows.sort((a,b)=>a.tick-b.tick);
  },
 };
}
