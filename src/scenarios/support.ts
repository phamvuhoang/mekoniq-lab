// Support matrix of a campaign fixture, read from the runtime's own health answer (UX-19, SIM-10). The Lab never decides a scenario is
// "available": every row carries the runtime's reason, and no runtime answer is `unknown`, never a guess.
import type {TwinHealth} from './controls';
export interface CampaignEntry {id:string;seed:number;repeat:number;mock:{backendSetId:string};simulation:{backendSetId:string;requires:string[]}}
export interface CampaignFixture {schemaVersion:1;id:string;revision:number;title:string;note?:string;scenarios:CampaignEntry[]}
export interface SupportRow {scenarioId:string;mode:'mock'|'simulation';backendSetId:string;status:'available'|'unavailable'|'unknown';reasons:string[]}
export function supportMatrix(health:TwinHealth|null,fixture:CampaignFixture):SupportRow[] {
 return fixture.scenarios.flatMap(s=>(['mock','simulation'] as const).map((mode):SupportRow=>{
  const backendSetId=s[mode].backendSetId;
  if(!health)return {scenarioId:s.id,mode,backendSetId,status:'unknown',reasons:['RUNTIME_UNREACHABLE']};
  const reasons:string[]=[];
  if(!health.scenarioIds.includes(s.id))reasons.push('SCENARIO_NOT_OFFERED');
  const set=health.backendSets.find(x=>x.id===backendSetId);
  if(!set)reasons.push(`BACKEND_SET_UNKNOWN:${backendSetId}`);
  else for(const id of mode==='simulation'?s.simulation.requires:set.backends){
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
