// Support matrix of a campaign fixture, read from the runtime's own health answer (UX-19, SIM-10). The Lab never decides a scenario is
// "available": every row carries the runtime's reason, and no runtime answer is `unknown`, never a guess.
import type {TwinHealth} from './controls';
export interface CampaignEntry {id:string;seed:number;repeat:number;mock:{backendSetId:string};simulation:{backendSetId:string;requires:string[]}}
export interface CampaignFixture {schemaVersion:1;id:string;revision:number;title:string;note?:string;scenarios:CampaignEntry[]}
export interface SupportRow {scenarioId:string;mode:'mock'|'simulation';backendSetId:string;status:'available'|'unavailable'|'unknown';reasons:string[]}
export interface SetOption {id:string;mode:string;selectable:boolean;reasons:string[]}
/** Backend sets the run selector offers. Portable sets (execution.host portable_python, i.e. IR-SIM 2D) are selectable only when health reports every backend
 * installed, enabled, compatible and reachable and advertises irsim_navigation_v1; legacy sets keep their behaviour (always listed and selectable). */
export function backendSetOptions(health:TwinHealth|null):SetOption[]{
 return (health?.backendSets??[]).filter(s=>['mock','simulation'].includes(s.mode)&&s.access==='simulated').map(s=>{
  if(s.execution?.host!=='portable_python')return {id:s.id,mode:s.mode,selectable:true,reasons:[]};
  const reasons:string[]=[];
  for(const id of s.backends){const b=health!.backends.find(x=>x.id===id);
   reasons.push(...!b?[`BACKEND_UNKNOWN:${id}`]:!b.installed?[`BACKEND_NOT_INSTALLED:${id}${b.reason?` (${b.reason})`:''}`]:!b.enabled?[`BACKEND_NOT_ENABLED:${id}`]:!b.compatible?[`BACKEND_INCOMPATIBLE:${id}`]:!b.reachable?[`BACKEND_UNREACHABLE:${id}`]:[]);}
  if(s.backends.includes('irsim_2d')&&!health!.capabilities?.includes('irsim_navigation_v1'))reasons.push('CAPABILITY_MISSING:irsim_navigation_v1');
  return {id:s.id,mode:s.mode,selectable:!reasons.length,reasons};
 });
}
export function supportMatrix(health:TwinHealth|null,fixture:CampaignFixture):SupportRow[] {
 return fixture.scenarios.flatMap(s=>(['mock','simulation'] as const).map((mode):SupportRow=>{
  const backendSetId=s[mode].backendSetId;
  if(!health)return {scenarioId:s.id,mode,backendSetId,status:'unknown',reasons:['RUNTIME_UNREACHABLE']};
  const reasons:string[]=[];
  if(!health.scenarioIds.includes(s.id))reasons.push('SCENARIO_NOT_OFFERED');
  const set=health.backendSets.find(x=>x.id===backendSetId);
  if(!set)reasons.push(`BACKEND_SET_UNKNOWN:${backendSetId}`);
  else for(const id of health.scenarioRequirements?.[s.id]?.[mode]??(mode==='simulation'?s.simulation.requires:set.backends)){
   const b=health.backends.find(x=>x.id===id);
   if(!set.backends.includes(id))reasons.push(`BACKEND_NOT_IN_SET:${id}`);
   else if(!b)reasons.push(`BACKEND_UNKNOWN:${id}`);
   else if(!b.installed)reasons.push(`BACKEND_NOT_INSTALLED:${id}${b.reason?` (${b.reason})`:''}`);
   else if(!b.enabled)reasons.push(`BACKEND_NOT_ENABLED:${id}`);
   else if(!b.compatible)reasons.push(`BACKEND_INCOMPATIBLE:${id}`);
   else if(!b.reachable)reasons.push(`BACKEND_UNREACHABLE:${id}`);
   else if(!b.commissioned)reasons.push(`BACKEND_NOT_COMMISSIONED:${id}`);
  }
  return {scenarioId:s.id,mode,backendSetId,status:reasons.length?'unavailable':'available',reasons};
 }));
}
