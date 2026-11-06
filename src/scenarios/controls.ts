// The twin's only path to execution: a small client over the source v2 gateway (/lab/v2). The UI never decides an outcome; every action
// is a request the runtime accepts or refuses, and a ViewState (selection, layers, view) is never an execution permission.
// TODO(interim-copy): RunView/RunReport mirror source packages/lab-runtime/src/v2/{scenario-runner,report}.ts; replace with the pinned artifact types (F07).
import type {LabProjectV2} from '../shared/types';
import type {TwinSample} from '../twin/store';
export interface TwinHealth {scenarioRequirements?:Record<string,{mock:string[];simulation:string[]}>;protocolMajors:number[];sourceCommit:string;schemaHash:string;scenarioIds:string[];
 backends:{id:string;modes:string[];installed:boolean;compatible:boolean;reachable:boolean;commissioned:boolean;enabled:boolean;reason?:string}[];
 backendSets:{id:string;mode:string;access:string;backends:string[]}[];features?:{polling?:boolean;sse?:boolean;readiness?:boolean};}
export interface ReadinessSnapshot {checkedAt:string;expiresAt:string;scenarioId:string;backendSetId:string;checks:{id:string;status:'ready'|'blocked'|'unknown';reasonCodes:string[];evidenceRef:string|null}[];canStart:boolean}
export interface RunSnapshotV2 {schemaVersion:2;id:string;mode:'mock'|'simulation'|'hardware';access:string;backendSetId:string;backends:string[];
 status:'ready'|'running'|'paused'|'awaiting_confirmation'|'needs_attention'|'completed'|'cancelled'|'failed';runRevision:number;eventCursor:string|null;telemetryCursor:string|null;
 fidelity:string;ageMs:number;sourceCommit:string;scenarioId:string;scenarioRevision:number;seed:number;}
export interface Attention {reason:string;tick:number;robotId?:string;subjectId?:string;commandId?:string}
export interface AmrView {sampleAgeMs?:number;id:string;kind:'amr';pose:{x:number;y:number;yawRad:number};quality:'valid'|'stale';moving:boolean;hold:string|null;goal:{commandId:string;state:string}|null;path:[number,number][];distanceM:number}
export interface CoffeeJobView {canRestoreCup?:boolean;waitingReason?:string|null;jobId:string;status:string;recipeId:string;cupId:string;attentionReason:string|null}
export interface CupView {cupId:string;ownerKind:string;ownerId:string}
export interface RunView {lockedInput?:CreateRun&{sourceCommit?:string};controlAccess?:'view_reconcile';run:RunSnapshotV2;tick:number;simTimeNs:string;model:string;entities:AmrView[];
 workload:{actor:string;tableId:string;status:string;missionId?:string}[];awaiting:{subjectId:string;confirmationType:string;missionId:string;robotId:string}[];
 attention:Attention[];served:string;coffee:{jobs:CoffeeJobView[];cups:CupView[]}|null;}
export interface Quantity {amount:string;unit:string;provenance:string;tolerance?:string}
export interface JobStep {id:string;kind:string;status:string;deviceId:string;commandId:string|null;target:Quantity|null;measured:Quantity|null;observedBy:string|null}
export interface ArmCollisionResult {ok:boolean;engine:string;geometryRevision:string;modelRevision:string;pair?:[string,string];toleranceM?:number;evaluations?:number;reason?:string;fraction?:number;clearanceM?:number}
export interface ArmCollisionScene {available:boolean;scope:'self_injected_only'|'self_scene_robot';reason?:string;revision:string;profileRevision:number|null;tick:number;world?:unknown[];robotPoses?:{id:string;from:[number,number];to:[number,number]}[]}
export interface ArmCollisionEvidence {
 intervals:{firstTick:number;lastTick:number;fromQ:number[];toQ:number[];heldCupId:string|null;worldRevision:string;sceneRevision:string|null;result:ArmCollisionResult}[];
 worlds:Record<string,unknown[]>;droppedIntervals:number|null;
 firstFailure?:{tick:number;fromQ:number[];toQ:number[];heldCupId:string|null;worldRevision:string;world:unknown[];scene:ArmCollisionScene|null;result:ArmCollisionResult};
 /** Replay describes retained checks only; a truncated final trace has no timestamps for its missing checks. */
 projection?:{cursorTick:number;lastCheckTick:number|null;retainedRange:{fromTick:number|null;toTick:number|null};historyComplete:boolean;worldScope:'checked_geometry';reason?:'SOURCE_TRACE_TRUNCATED'|'MISSING_RECORDED_WORLD'};
}
export interface ArmCollisionView {world:unknown[];checks:number|null;last:ArmCollisionResult|null;scene?:ArmCollisionScene;evidence?:ArmCollisionEvidence}
export interface ArmStopView {latched:boolean;reconcileRequired:boolean;reason:string;events:{tick:number;stage:'requested'|'acknowledged'|'observed'|'reset';reason:string;provenance:'modelled'}[]}
export interface RunReport {manifest:{armCollisionScene?:{hash:string;profile:LabProjectV2['armCollisionProfile']|null;profileHash:string|null;world:LabProjectV2['world'];worldHash:string;robotGeometry:{id:string;radiusM:number|null}[]};hashAlgorithm?:string;designHash?:string;models?:{id:string;revision:string|number;hash:string;provenance:string}[];recipes?:{id:string;revision:number;hash:string}[];profiles?:{id:string;revision:number;hash:string;provenance:string}[];adapterHash?:string;calibration?:{status:string;revision:string|number|null;hash:string|null;reason?:string};runId:string;sourceCommit:string;mode:string;access:string;backendSetId:string;backends:{id:string;version:string;model:string;dynamics:boolean}[];clock:{tickMs:number};seed:number;
  scenario:{id:string;revision:number;hash:string};project:{id:string;revision:number;hash:string};world:{id:string;revision:number;hash:string};assets:{id:string;revision:number;contentHash:string;resolved:boolean}[]};
 outcome:{status:string;served:string;tick:number;simTimeNs:string};
 metrics:{maxConcurrentMovers?:number;distanceM:Record<string,number>;collision:{available:boolean;reason?:string;contacts:number|null;minSeparationM:number|null}};
 /** Durable: read back from the source journal, each with its journal sequence. */
 businessEvents:{sequence:string;at:string;type:string;kind:string;id:string;state?:Record<string,unknown>}[];faults:{tick:number;faultId:string;entityId:string|null}[];
 effects:{id:string;type:string;status:string;attempts:number;payload:Record<string,unknown>}[];attention?:Attention[];
 /** Lossy, coalesced: never an audit ledger (F06). Absent in reports from runtimes before F06. */
 telemetry?:{lossy:true;coalesced:true;rateHz:number;source:string;samples:TwinSample[];sampleCounts:Record<string,number>;dropped:number;gaps:{reason:string;fromTick:number|null;toTick:number}[]};
 reconciliations:{subjectId:string;commandId:string|null;nativeState:string;tick:number}[];coverage:Record<string,boolean>;limitations:string[];
 coffee?:{plantLog?:Record<string,unknown>[];jobs:{jobId:string;recipeId:string;recipeRevision:number;status:string;steps:JobStep[]}[];cups:{cupId:string;ownerKind:string;ownerId:string;movements:{transferId:string;provenance:string;observedBy:string;at:string}[]}[];
  armTrace:{collision?:ArmCollisionView|null;stop?:ArmStopView|null;tag:string;interpolation:string;modelRevision:string;limitsOk:boolean;samples:{tick:number;q:number[];tcp:[number,number,number]}[]}};}
export interface CreateRun {project:LabProjectV2;scenarioId:string;scenarioRevision:number;seed:number;mode:'mock';backendSetId:string;access:'simulated'}
export type ActionKind='start'|'pause'|'resume'|'cancel'|'step'|'confirm'|'injectFault'|'reconcile'|'restoreCup';
export interface TwinRuntime {
 readiness?(scenarioId:string,backendSetId:string,project?:LabProjectV2):Promise<ReadinessSnapshot>;
 health():Promise<TwinHealth>;pair(token:string):Promise<void>;readonly paired:boolean;
 /** Drop the in-memory CSRF token after the runtime lost the session (restart): the pair form shows again. */
 forget():void;
 create(request:CreateRun,identity:{sourceCommit:string;schemaHash:string}):Promise<RunView>;
 action(view:RunView,kind:ActionKind,payload?:Record<string,unknown>):Promise<RunView>;
 readonly recoverableRunIds?:readonly string[];archive?(runId:string):Promise<void>;reclaim?(runId:string):Promise<RunView>;
 get(runId:string):Promise<RunView>;report(runId:string):Promise<RunReport>;
}
export class TwinRuntimeError extends Error {
 constructor(readonly code:string,readonly reasonCodes:string[],readonly status:number){super(reasonCodes.length?`${code}: ${reasonCodes.join(', ')}`:code);this.name='TwinRuntimeError';}
}
export function httpTwinRuntime(base='/lab/v2'):TwinRuntime {
 let csrf='';
 const storageKey='mekoniq-lab-reclaim';let proofs:Record<string,string>={};
 try{proofs=JSON.parse(localStorage.getItem(storageKey)??'{}');}catch{/* no local ownership proofs */}
 const request=async<T>(path:string,body?:unknown):Promise<T>=>{
  const post=body!==undefined,response=await fetch(base+path,{method:post?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:post?{'Content-Type':'application/json',...csrf?{'X-CSRF-Token':csrf}:{}}:{},...post?{body:JSON.stringify(body)}:{}});
  const data=await response.json().catch(()=>({error:'INVALID_RUNTIME_RESPONSE'}));
  if(!response.ok)throw new TwinRuntimeError(String(data.error??'RUNTIME_REQUEST_FAILED'),Array.isArray(data.reasonCodes)?data.reasonCodes.map(String):[],response.status);
  return data as T;
 };
 const run=(id:string)=>`/runs/${encodeURIComponent(id)}`;
 return {
  get paired(){return !!csrf;},forget(){csrf='';},
  health:()=>request<TwinHealth>('/health'),
  readiness:(scenarioId,backendSetId,project)=>project?request<ReadinessSnapshot>('/readiness',{scenarioId,backendSetId,project}):request<ReadinessSnapshot>(`/readiness?scenarioId=${encodeURIComponent(scenarioId)}&backendSetId=${encodeURIComponent(backendSetId)}`),
  async pair(token){const r=await request<{csrfToken?:string}>('/sessions',{token});if(!r.csrfToken)throw new TwinRuntimeError('INVALID_PAIRING_RESPONSE',[],502);csrf=r.csrfToken;},
  async create(r,identity){const {reclaimToken,...view}=await request<RunView&{reclaimToken?:string}>('/runs',{...r,runtimeIdentity:identity});if(reclaimToken){proofs[view.run.id]=reclaimToken;try{localStorage.setItem(storageKey,JSON.stringify(proofs));}catch{/* current tab retains the proof if storage is unavailable */}}return view;},
  get recoverableRunIds(){return Object.keys(proofs);},
  async archive(id){await request(`${run(id)}/archive`,{});},
  reclaim:id=>{const proof=proofs[id];if(!proof)throw new TwinRuntimeError('RUN_PROOF_MISSING',[],403);return request<RunView>(`${run(id)}/reclaim`,{proof});},
  // expectedRevision comes from the last snapshot the UI rendered: a stale view is refused (REVISION_CONFLICT), never applied
  action:(v,kind,payload={})=>request<RunView>(`${run(v.run.id)}/actions`,{actionId:crypto.randomUUID(),expectedRevision:v.run.runRevision,kind,payload}),
  get:id=>request<RunView>(run(id)),
  report:id=>request<RunReport>(`${run(id)}/report`),
 };
}
