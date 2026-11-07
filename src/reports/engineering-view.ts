// Display model for the engineering part of a report. Old reports have none; a run that did not pass never shows metrics as if it had.
import type {RunReport} from '../scenarios/controls';
export interface EngineeringView {
 status:'pass'|'fail'|'not_run';tone:'ok'|'fail'|'blocked';blockers:string[];showMetrics:boolean;
 capabilities:{id:string;level:'unsupported'|'modeled'|'verified'}[];ref:{bundleDigest:string;projectDigest:string}|null;
}
const TONE={pass:'ok',fail:'fail',not_run:'blocked'} as const;
export function engineeringView(report:RunReport):EngineeringView|null {
 const a=report.engineeringEvidence;if(!a)return null;
 return {status:a.status,tone:TONE[a.status],blockers:a.status==='pass'?[]:[...a.reasons],showMetrics:a.status==='pass',
  capabilities:Object.entries(a.capabilities).map(([id,level])=>({id,level})),ref:report.manifest.engineering??null};
}
