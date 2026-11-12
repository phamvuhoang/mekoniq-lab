// D58/D65: the live 3D view's playback rules, apart from the page. Pure: the reduced-motion query and the freshness test are parameters and every
// time is passed in (the store's receipt clock). One SampleBuffer per entity; never an interpolation across a change of display source, an epoch
// reset, a gap or a link loss (the buffer is replaced or cleared); a stale sample is never advanced (its buffer is deleted).
import {SampleBuffer,lerpJoints,lerpPose} from './sample-buffer';
import {armJointsView,displayJoints} from './arm/arm-telemetry';
import {pose3dOf,rosQuat} from './pose3d';
import type {Held} from './store';
import type {TwinPoses} from '../viewer/twin3d';
export interface PlaybackEnv {reducedMotion():boolean;/** the entity's telemetry is live at `nowMs` (not stale, not lost) */fresh(entityId:string,nowMs:number):boolean}
export class LivePlayback {
 /** `at`: when the newest sample of the buffer arrived. */
 private bufs=new Map<string,{src:string;b:SampleBuffer<number[]>;at:number}>();
 constructor(private env:PlaybackEnv){}
 /** Arm joints (observed, else commanded) or an AMR base pose `[x, y, yaw, z?, roll?, pitch?]` into the entity's buffer. */
 feed(h:Held,epochReset:boolean):void{
  const d=displayJoints(null,armJointsView(h,h.receivedAtMs)),o=h.observed,p3=pose3dOf(o);let src:string|null=null,val:number[]=[];
  if(d.jointsRad){if(!d.frozen){src=d.source;val=d.jointsRad;}}
  else if(h.quality==='valid'&&typeof o?.xM==='number'&&typeof o.yM==='number'&&typeof o.yawRad==='number'){src=p3.z===undefined?'pose':'pose3d';val=[o.xM,o.yM,o.yawRad,...p3.z===undefined?[]:[p3.z,p3.rollRad!,p3.pitchRad!]];}
  if(!src||h.simTimeNs===null){this.bufs.delete(h.entityId);return;}
  let e=this.bufs.get(h.entityId);
  if(epochReset||e?.src!==src){e={src,b:new SampleBuffer<number[]>(src.startsWith('pose')?lerpPose:lerpJoints),at:0};this.bufs.set(h.entityId,e);}
  e.b.push(BigInt(h.simTimeNs),h.receivedAtMs,val);e.at=h.receivedAtMs;
 }
 /** A telemetry gap, a link loss or a new run. */
 clear():void{this.bufs.clear();}
 /** The exact poses with each live entity's buffered value at `nowMs`; an entity that is not live keeps its exact (frozen) pose. */
 poses(exact:TwinPoses,nowMs:number):TwinPoses{
  const arms={...exact.arms},bodies={...exact.bodies};
  for(const [id,e] of this.bufs){
   if(!this.env.fresh(id,nowMs))continue;const v=e.b.at(nowMs);if(!v)continue;
   if(e.src.startsWith('pose')){if(bodies[id])bodies[id]={positionM:[v[0]!,v[1]!,v[3]??0],quaternionXyzw:rosQuat(v[2]!,v[5]??0,v[4]??0)};}else if(arms[id])arms[id]={...arms[id]!,jointsRad:v};
  }
  return {arms,bodies};
 }
 /** Animate only a live run (not a replay) that had a sample in the last second, without reduced motion; otherwise the view is drawn per sample. */
 animating(nowMs:number,s:{live:boolean;replay:boolean}):boolean{
  return s.live&&!s.replay&&[...this.bufs.values()].some(e=>nowMs-e.at<1000)&&!this.env.reducedMotion();
 }
}
