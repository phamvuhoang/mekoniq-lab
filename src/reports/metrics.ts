import type {RunEvent} from '../shared/types';
interface RecordedReport {schemaVersion:1;mode:'business_sim';sourceCommit:string;snapshot:{status:string;served:string;elapsedMs:number;events:RunEvent[]};effects:{type:string;attempts?:number}[];}
function parseReport(value:unknown):RecordedReport {
 if(!value||typeof value!=='object')throw new Error('INVALID_REPORT');
 const r=value as RecordedReport;
 if(r.mode!=='business_sim')throw new Error('UNSUPPORTED_REPORT_MODE');
 if(r.schemaVersion!==1||typeof r.sourceCommit!=='string'||!r.snapshot||!Number.isFinite(r.snapshot.elapsedMs)||r.snapshot.elapsedMs<0||!/^\d+$/.test(r.snapshot.served)||!Array.isArray(r.snapshot.events)||r.snapshot.events.length>100000||!Array.isArray(r.effects))throw new Error('INVALID_REPORT');
 let last=-Infinity;
 for(const event of r.snapshot.events){const time=Date.parse(event.at);if(typeof event.type!=='string'||!Number.isFinite(time)||time<last)throw new Error('INVALID_REPORT');last=time;}
 for(const effect of r.effects)if(typeof effect.type!=='string'||(effect.attempts!==undefined&&(!Number.isSafeInteger(effect.attempts)||effect.attempts<0)))throw new Error('INVALID_REPORT');
 return structuredClone(r);
}
export function summarizeReport(value:unknown) {
 const report=parseReport(value);let start:number|undefined,arrival:number|undefined,travelMs=0,humanWaitMs=0;
 for(const event of report.snapshot.events){const now=Date.parse(event.at);
  if(event.type==='RobotCommandIssued'){start=now;arrival=undefined;}
  else if(event.type==='RobotGoalCompleted'&&start!==undefined){travelMs+=now-start;start=undefined;arrival=now;}
  else if(['CargoLoaded','DeliveryHandedOff','CargoReturned'].includes(event.type)&&arrival!==undefined){humanWaitMs+=now-arrival;arrival=undefined;}
 }
 return {evidence:'business_sim' as const,outcome:report.snapshot.status,elapsedMs:report.snapshot.elapsedMs,served:report.snapshot.served,travelMs,humanWaitMs,distanceM:null,executeAttempts:report.effects.filter(e=>e.type==='robot.execute').reduce((n,e)=>n+(e.attempts??0),0),sampleCount:1,sourceCommit:report.sourceCommit};
}
/** Read model only: replay has no dependency on a command client or executor. */
export function openReplay(value:unknown) {
 const report=parseReport(value),events=report.snapshot.events,origin=events.length?Date.parse(events[0]!.at):0;
 return {summary:()=>summarizeReport(report),seek(milliseconds:number):RunEvent[]{if(!Number.isFinite(milliseconds))throw new Error('INVALID_REPLAY_CURSOR');const limit=origin+Math.max(0,Math.min(milliseconds,report.snapshot.elapsedMs));return structuredClone(events.filter(e=>Date.parse(e.at)<=limit));}};
}
