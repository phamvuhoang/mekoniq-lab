// Optional WebGL view of the same TwinFrame/ViewState the 2D plan draws. Read-only; renders on demand (no animation loop), so reduced
// motion holds. Any WebGL failure returns null or calls onFail and the workspace stays on the 2D plan with the same selection.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {observedSegments,sceneEntities,type TwinFrame,type ViewState} from '../twin/scene';
import {amrFootprint,assetOf} from '../twin/amr';
import {footprintInMap} from '../twin/lidar';
import {bodyPlacement} from '../twin/pose3d';
import {armFrames,type ArmJointDef} from '../twin/arm/arm-frames';
import {armJointsView,displayJoints} from '../twin/arm/arm-telemetry';
import {armChain} from './arm-chain';
import armComponent from '../../fixtures/engineering/arm-ref-3d-v1/component.json' with {type:'json'};
const ARM_JOINTS=armComponent.joints as unknown as ArmJointDef[];
export interface Twin3d {canvas:HTMLCanvasElement;/** Move into a re-rendered stage and size from it. */attach(host:HTMLElement):void;update(f:TwinFrame,vs:ViewState):void;dispose():void}
const LIME=0xb4f375,NAVY=0x182a33;
const COLOR:Record<string,number>={footprint:0x9dccff,safety:0xf0b45a,observed:0x5ad1c6};
export interface OverlayShape {layer:'path'|'footprint'|'safety'|'observed';entityId:string;loop:boolean;z:number;points:[number,number][]}
/** The plan overlays of the 3D view, from the same frame data and helpers the 2D plan uses (no data of its own). Pure: what update() draws. */
export function overlayShapes(f:TwinFrame,vs:ViewState):OverlayShape[]{
 const out:OverlayShape[]=[];
 for(const r of f.view?.entities??[]){
  if(vs.layers.path&&r.path.length)out.push({layer:'path',entityId:r.id,loop:false,z:0.02,points:[[r.pose.x,r.pose.y],...r.path.map(([x,y])=>[x!,y!] as [number,number])]});
  // IR-SIM runs: the compiled footprint on the drive frame (T_map_base x T_base_drive); other runs: the Lab asset footprint
  const model=f.navigation?.robots.find(x=>x.robotId===r.id)?.model,poly=vs.layers.footprint?model?footprintInMap(model,r.pose):f.navigation?null:amrFootprint(assetOf(f.preset.project,f.preset.assets,r.id),r.pose):null;
  if(poly)out.push({layer:'footprint',entityId:r.id,loop:true,z:0.03,points:poly});
  // IR-SIM only, as on the 2D plan: the compiled footprint offset by the policy safety margin, and the observed telemetry path (never joined across a gap)
  if(vs.layers.safety&&model&&f.navigation)out.push({layer:'safety',entityId:r.id,loop:true,z:0.035,points:footprintInMap(model,r.pose,f.navigation.policy.parameters.safetyMarginM)});
  if(vs.layers.observed&&model&&f.navigation)for(const seg of observedSegments(f,r.id))out.push({layer:'observed',entityId:r.id,loop:false,z:0.025,points:seg});
 }
 return out;
}
export function mountTwin3d(host:HTMLElement,onSelect:(id:string)=>void,onFail:()=>void):Twin3d|null {
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{return null;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','3D twin view. Use the entity list to select objects.');
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();queueMicrotask(onFail);});
 host.replaceChildren(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,0.1,200),controls=new OrbitControls(camera,canvas);
 controls.enableDamping=false;controls.maxPolarAngle=Math.PI*0.48;
 scene.add(new THREE.HemisphereLight(0xc9e8ff,0x24373b,2.6));const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(3,8,4);scene.add(sun);
 const dynamic=new THREE.Group();scene.add(dynamic);
 const mat=(color:number,o:{wire?:boolean;emissive?:boolean}={})=>new THREE.MeshStandardMaterial({color,wireframe:!!o.wire,emissive:o.emissive?LIME:0x000000,emissiveIntensity:o.emissive?0.6:0,roughness:0.7});
 const render=()=>renderer.render(scene,camera);
 // size from wherever the canvas lives now: the stage element is replaced on every workspace render
 const resize=()=>{const p=canvas.parentElement,w=p?.clientWidth||640,h=p?.clientHeight||420;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 const ro=new ResizeObserver(resize);ro.observe(host);controls.addEventListener('change',render);
 let last:{w:number;h:number}|null=null;
 const pick=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  const hit=ray.intersectObjects(dynamic.children,true).find(h=>h.object.userData.entityId);if(hit)onSelect(String(hit.object.userData.entityId));};
 let down:[number,number]=[0,0];
 canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)pick(e);});
 return {canvas,
  attach(next){if(canvas.parentElement!==next)next.replaceChildren(canvas);ro.disconnect();ro.observe(next);resize();},
  update(f,vs){
   const w=f.preset.project.world,at=(x:number,y:number,z=0)=>new THREE.Vector3(x,z,-y);
   if(!last||last.w!==w.width||last.h!==w.height){last={w:w.width,h:w.height};camera.position.set(w.width/2,Math.max(w.width,w.height)*0.9,w.height*0.4+Math.max(w.width,w.height)*0.6);controls.target.set(w.width/2,0,-w.height/2);controls.update();}
   for(const c of [...dynamic.children]){dynamic.remove(c);c.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();(m.material as THREE.Material|undefined)?.dispose?.();});}
   const floor=new THREE.Mesh(new THREE.PlaneGeometry(w.width,w.height),mat(0x101e25));floor.rotation.x=-Math.PI/2;floor.position.copy(at(w.width/2,w.height/2));dynamic.add(floor);
   const grid=new THREE.GridHelper(Math.max(w.width,w.height),Math.max(w.width,w.height),0x4a626a,0x2c424b);grid.position.copy(at(Math.max(w.width,w.height)/2,Math.max(w.width,w.height)/2,0.001));dynamic.add(grid);
   for(const o of w.obstacles){const m=new THREE.Mesh(new THREE.BoxGeometry(o.width,0.9,o.height),mat(0x29414b));m.position.copy(at(o.x+o.width/2,o.y+o.height/2,0.45));dynamic.add(m);}
   for(const o of f.navigation?.world.obstacles??[])dynamic.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(o.verticesM.map(v=>at(v[0]!,v[1]!,0.04))),new THREE.LineBasicMaterial({color:0xf0b45a})));
   // Tables are schematic context, not collision geometry; runtime obstacles and footprint overlays remain the model.
   for(const p of w.points.filter(p=>p.kind==='table')){const table=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.08,20),mat(0x43585d));table.position.copy(at(p.x,p.y,0.72));dynamic.add(table);}
   for(const e of sceneEntities(f)){
    if(!Number.isFinite(e.x)||e.kind==='job')continue;
    const on=e.id===vs.selected,unknown=e.source==='unknown';
    // an arm with joint telemetry and a base pose is drawn as its joint chain (what the runtime last reported, never extrapolated); otherwise the single cylinder below
    if(e.kind==='arm'){
     const sample=f.samples?.[e.id],view=sample?armJointsView(sample,f.nowMs??sample.receivedAtMs):null,shown=displayJoints(null,view),base=f.preset.project.armCollisionProfile?.baseInMap;
     if(shown.jointsRad&&base){
      const chain=armChain(armFrames(ARM_JOINTS,shown.jointsRad),mat(NAVY+0x101010,{wire:shown.source!=='observed'||shown.frozen,emissive:on}));
      const [px,py,pz]=base.position as [number,number,number],[qx,qy,qz,qw]=base.quaternionXyzw as [number,number,number,number];
      chain.quaternion.set(qx,qy,qz,qw);chain.position.set(px,py,pz);
      const holder=new THREE.Group();holder.rotation.x=-Math.PI/2;holder.add(chain); // ROS (z up) -> scene (y up): (x, y, z) -> (x, z, -y); the chain sits at the base pose in the ROS map
      holder.traverse(o=>{o.userData.entityId=e.id;});dynamic.add(holder);continue;
     }
    }
    const geo=e.kind==='amr'?new THREE.CylinderGeometry(0.3,0.3,0.45,24):e.kind==='coffee_machine'?new THREE.BoxGeometry(0.4,0.45,0.3):e.kind==='arm'?new THREE.CylinderGeometry(0.09,0.12,0.7,16):e.kind==='cup'?new THREE.CylinderGeometry(0.05,0.04,0.12,16):new THREE.BoxGeometry(0.25,0.3,0.25);
    const m=new THREE.Mesh(geo,mat(e.kind==='amr'?0xd3dcd3:e.kind==='cup'?0xf5f0e6:NAVY+0x101010,{wire:unknown||e.source==='derived',emissive:on}));
    const h=e.kind==='amr'?0.225:e.kind==='coffee_machine'?1.125:e.kind==='arm'?1.25:e.kind==='cup'?(e.status?.startsWith('robot')?0.52:e.status?.startsWith('customer')?0.8:1.0):1.05;
    if(e.kind==='amr'&&e.pose3d){
     // a 3D plant: lift and tip the body by the plant's own base height and tilt (the wheel radius is the base origin's height when it stands level)
     const wheel=f.navigation?.robots.find(r=>r.robotId===e.id)?.model.kinematics.wheelRadiusM??0.09,pl=bodyPlacement({x:e.x,y:e.y,yawRad:e.yawRad??0,...{z:e.pose3d.z,rollRad:e.pose3d.rollRad,pitchRad:e.pose3d.pitchRad}},h,wheel);
     m.position.set(...pl.position);m.quaternion.set(...pl.quaternion);
    }else m.position.copy(at(e.x,e.y,h));
    m.userData.entityId=e.id;dynamic.add(m);
   }
   for(const sh of overlayShapes(f,vs)){
    const pts=sh.points.map(([x,y])=>at(x,y,sh.z)),g=new THREE.BufferGeometry().setFromPoints(pts);
    if(sh.layer==='path')dynamic.add(new THREE.Line(g,new THREE.LineDashedMaterial({color:LIME,dashSize:0.08,gapSize:0.06})).computeLineDistances());
    else dynamic.add(sh.loop?new THREE.LineLoop(g,new THREE.LineBasicMaterial({color:COLOR[sh.layer]})):new THREE.Line(g,new THREE.LineBasicMaterial({color:COLOR[sh.layer]})));
   }
   for(const r of f.view?.entities??[])if(vs.layers.frames){const ax=new THREE.AxesHelper(0.4);ax.position.copy(at(r.pose.x,r.pose.y,0.5));ax.rotation.y=r.pose.yawRad;dynamic.add(ax);}
   if(vs.layers.frames)dynamic.add(new THREE.AxesHelper(0.6));
   resize();
  },
  dispose(){ro.disconnect();controls.dispose();renderer.dispose();canvas.remove();},
 };
}
