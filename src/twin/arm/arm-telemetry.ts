// Arm telemetry for the twin (plan 03 A05): a TwinSample of an arm entity (mock_arm commanded-only, or linuxcnc_sim controller_sim with
// actual joints) becomes a view with commanded and actual apart, the source timestamp, freshness by the browser's receipt clock and the
// provider's provenance. Rendering only ever shows the latest observed value: no extrapolation, no animation that completes a pickup.
import type {Held} from '../store';
export interface ArmJointsView {jointsActualRad:number[]|null;jointsCommandedRad:number[]|null;/** observed gripper opening, when the provider reports one */gripperOpeningM:number|null;tcpM:[number,number,number]|null;homed:boolean|null;gripper:'open'|'closed'|'unknown';
 provenance:'controller_sim'|'mock'|'physics_sim'|'hardware';providerId:string;bootId:string;seq:string;observedAt:string|null;quality:'valid'|'stale'|'unknown'|'invalid';ageMs:number;stale:boolean;reasonCodes:string[]}
const six=(v:unknown):number[]|null=>Array.isArray(v)&&v.length===6&&v.every(n=>typeof n==='number'&&Number.isFinite(n))?[...v] as number[]:null;
/** `nowMs` is the browser's receipt clock (performance.now domain of the store); staleMs is the gateway/profile threshold (500 ms default). */
export function armJointsView(sample:Held,nowMs:number,staleMs=500):ArmJointsView {
 const obs=(sample.observed??{}) as Record<string,unknown>,cmd=(sample.commanded??{}) as Record<string,unknown>,ageMs=Math.max(0,nowMs-sample.receivedAtMs),stale=ageMs>staleMs||sample.quality==='stale';
 const tcp=Array.isArray(obs.tcpM)&&obs.tcpM.length===3&&(obs.tcpM as unknown[]).every(n=>typeof n==='number')?[...obs.tcpM] as [number,number,number]:null;
 return {jointsActualRad:six(obs.jointsRad),jointsCommandedRad:six(cmd.jointsRad),gripperOpeningM:typeof obs.gripperOpeningM==='number'&&Number.isFinite(obs.gripperOpeningM)?obs.gripperOpeningM:null,tcpM:tcp,homed:typeof obs.homed==='boolean'?obs.homed:null,gripper:cmd.gripper==='open'||cmd.gripper==='closed'?cmd.gripper:'unknown',
  provenance:sample.origin,providerId:sample.providerId,bootId:sample.bootId,seq:sample.seq,observedAt:sample.observedAt,quality:stale&&sample.quality==='valid'?'stale':sample.quality,ageMs,stale,reasonCodes:[...sample.reasonCodes,...stale&&!sample.reasonCodes.includes('STALE')?['STALE']:[]]};
}
/** What the renderer may draw between two samples: the latest observed joints, frozen while stale; never an interpolation past the last sample. */
export function displayJoints(previous:ArmJointsView|null,latest:ArmJointsView|null):{jointsRad:number[]|null;source:'observed'|'commanded'|'unknown';frozen:boolean} {
 const v=latest??previous;if(!v)return {jointsRad:null,source:'unknown',frozen:false};
 if(v.jointsActualRad)return {jointsRad:v.jointsActualRad,source:'observed',frozen:v.stale};
 if(v.jointsCommandedRad)return {jointsRad:v.jointsCommandedRad,source:'commanded',frozen:v.stale};
 return {jointsRad:null,source:'unknown',frozen:v.stale};
}
