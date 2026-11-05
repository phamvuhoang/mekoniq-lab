// The twin's only path to execution: a small client over the source v2 gateway (/lab/v2). The UI never decides an outcome; every action
// is a request the runtime accepts or refuses, and a ViewState (selection, layers, view) is never an execution permission.
// TODO(interim-copy): RunView/RunReport mirror source packages/lab-runtime/src/v2/{scenario-runner,report}.ts; replace with the pinned artifact types (F07).
import type {LabProjectV2} from '../shared/types';
export interface TwinHealth {protocolMajors:number[];sourceCommit:string;schemaHash:string;scenarioIds:string[];
 backends:{id:string;modes:string[];installed:boolean;compatible:boolean;reachable:boolean;commissioned:boolean;enabled:boolean;reason?:string}[];
 backendSets:{id:string;mode:string;access:string;backends:string[]}[];}
export interface RunSnapshotV2 {schemaVersion:2;id:string;mode:'mock'|'simulation'|'hardware';access:string;backendSetId:string;backends:string[];
 status:'ready'|'running'|'paused'|'awaiting_confirmation'|'needs_attention'|'completed'|'cancelled'|'failed';runRevision:number;eventCursor:string|null;telemetryCursor:string|null;
 fidelity:string;ageMs:number;sourceCommit:string;scenarioId:string;scenarioRevision:number;seed:number;}
export interface Attention {reason:string;tick:number;robotId?:string;subjectId?:string;commandId?:string}
export interface AmrView {id:string;kind:'amr';pose:{x:number;y:number;yawRad:number};quality:'valid'|'stale';moving:boolean;hold:string|null;goal:{commandId:string;state:string}|null;path:[number,number][];distanceM:number}
export interface CoffeeJobView {jobId:string;status:string;recipeId:string;cupId:string;attentionReason:string|null}
export interface CupView {cupId:string;ownerKind:string;ownerId:string}
export interface RunView {run:RunSnapshotV2;tick:number;simTimeNs:string;model:string;entities:AmrView[];
 workload:{actor:string;tableId:string;status:string;missionId?:string}[];awaiting:{subjectId:string;confirmationType:string;missionId:string;robotId:string}[];
 attention:Attention[];served:string;coffee:{jobs:CoffeeJobView[];cups:CupView[]}|null;}
export interface Quantity {amount:string;unit:string;provenance:string;tolerance?:string}
export interface JobStep {id:string;kind:string;status:string;deviceId:string;commandId:string|null;target:Quantity|null;measured:Quantity|null;observedBy:string|null}
export interface RunReport {manifest:{runId:string;sourceCommit:string;mode:string;backendSetId:string;backends:{id:string;version:string;model:string;dynamics:boolean}[];clock:{tickMs:number};seed:number;
  scenario:{id:string;revision:number;hash:string};project:{id:string;revision:number;hash:string};world:{id:string;revision:number;hash:string};assets:{id:string;revision:number;contentHash:string;resolved:boolean}[]};
 metrics:{collision:{available:boolean;reason?:string;contacts:number|null;minSeparationM:number|null}};
 businessEvents:{sequence:string;at:string;type:string;kind:string;id:string}[];faults:{tick:number;faultId:string;entityId:string|null}[];
 reconciliations:{subjectId:string;commandId:string|null;nativeState:string;tick:number}[];coverage:Record<string,boolean>;limitations:string[];
 coffee?:{jobs:{jobId:string;recipeId:string;recipeRevision:number;status:string;steps:JobStep[]}[];cups:{cupId:string;ownerKind:string;ownerId:string;movements:{transferId:string;provenance:string;observedBy:string;at:string}[]}[];
  armTrace:{tag:string;interpolation:string;modelRevision:string;limitsOk:boolean;samples:{tick:number;q:number[];tcp:[number,number,number]}[]}};}
export interface CreateRun {project:LabProjectV2;scenarioId:string;scenarioRevision:number;seed:number;mode:'mock';backendSetId:string;access:'simulated'}
export type ActionKind='start'|'pause'|'resume'|'cancel'|'step'|'confirm'|'injectFault'|'reconcile';
export interface TwinRuntime {
 health():Promise<TwinHealth>;pair(token:string):Promise<void>;readonly paired:boolean;
 create(request:CreateRun,identity:{sourceCommit:string;schemaHash:string}):Promise<RunView>;
 action(view:RunView,kind:ActionKind,payload?:Record<string,unknown>):Promise<RunView>;
 get(runId:string):Promise<RunView>;report(runId:string):Promise<RunReport>;
}
export class TwinRuntimeError extends Error {
 constructor(readonly code:string,readonly reasonCodes:string[],readonly status:number){super(reasonCodes.length?`${code}: ${reasonCodes.join(', ')}`:code);this.name='TwinRuntimeError';}
}
export function httpTwinRuntime(base='/lab/v2'):TwinRuntime {
 let csrf='';
 const request=async<T>(path:string,body?:unknown):Promise<T>=>{
  const post=body!==undefined,response=await fetch(base+path,{method:post?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:post?{'Content-Type':'application/json',...csrf?{'X-CSRF-Token':csrf}:{}}:{},...post?{body:JSON.stringify(body)}:{}});
  const data=await response.json().catch(()=>({error:'INVALID_RUNTIME_RESPONSE'}));
  if(!response.ok)throw new TwinRuntimeError(String(data.error??'RUNTIME_REQUEST_FAILED'),Array.isArray(data.reasonCodes)?data.reasonCodes.map(String):[],response.status);
  return data as T;
 };
 const run=(id:string)=>`/runs/${encodeURIComponent(id)}`;
 return {
  get paired(){return !!csrf;},
  health:()=>request<TwinHealth>('/health'),
  async pair(token){const r=await request<{csrfToken?:string}>('/sessions',{token});if(!r.csrfToken)throw new TwinRuntimeError('INVALID_PAIRING_RESPONSE',[],502);csrf=r.csrfToken;},
  create:(r,identity)=>request<RunView>('/runs',{...r,runtimeIdentity:identity}),
  // expectedRevision comes from the last snapshot the UI rendered: a stale view is refused (REVISION_CONFLICT), never applied
  action:(v,kind,payload={})=>request<RunView>(`${run(v.run.id)}/actions`,{actionId:crypto.randomUUID(),expectedRevision:v.run.runRevision,kind,payload}),
  get:id=>request<RunView>(run(id)),
  report:id=>request<RunReport>(`${run(id)}/report`),
 };
}
