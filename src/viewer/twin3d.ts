// Optional WebGL view of the same TwinFrame/ViewState the 2D plan draws. Read-only. The scene is kept: update() rebuilds it only when its structure
// (structureKey) changes and otherwise moves what is there; pose() only changes transforms. Renders on demand: the workspace drives pose() from an
// animation frame only while live samples arrive and reduced motion is not requested. Any WebGL failure returns null or calls onFail and the
// workspace stays on the 2D plan with the same selection.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {observedSegments,sceneEntities,type SceneEntity,type TwinFrame,type ViewState} from '../twin/scene';
import {amrFootprint,assetOf} from '../twin/amr';
import {footprintInMap} from '../twin/lidar';
import {placeBody,rosQuat,yawOf} from '../twin/pose3d';
import {armFrames,type ArmJointDef} from '../twin/arm/arm-frames';
import {armJointsView,displayJoints} from '../twin/arm/arm-telemetry';
import {armChain,poseArmChain} from './arm-chain';
import armComponent from '../../fixtures/engineering/arm-ref-3d-v1/component.json' with {type:'json'};
const ARM_JOINTS=armComponent.joints as unknown as ArmJointDef[];
/** Transforms only. `bodies`: an AMR's base origin in the ROS map (z up; z 0 for a planar plant) and its ROS orientation. `arms`: the joints shown. */
export interface TwinPoses {arms:Record<string,{jointsRad:number[];gripperOpeningM:number|null}>;bodies:Record<string,{positionM:[number,number,number];quaternionXyzw:[number,number,number,number]}>}
export interface Twin3d {canvas:HTMLCanvasElement;/** Move into a re-rendered stage and size from it. */attach(host:HTMLElement):void;update(f:TwinFrame,vs:ViewState):void;pose(p:TwinPoses):void;
 /** Camera back to the view of the whole floor it starts with. */home():void;/** Frame one object, or the whole scene for null or an object not drawn. */fit(entityId:string|null):void;dispose():void}
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
/** What the scene draws: placed entities (no jobs), and for an arm the joints it shows (observed, else commanded; frozen while stale). */
function drawn(f:TwinFrame){
 return sceneEntities(f).filter(e=>Number.isFinite(e.x)&&e.kind!=='job').map(e=>{
  if(e.kind!=='arm')return {e,arm:null};
  const s=f.samples?.[e.id],v=s?armJointsView(s,f.nowMs??s.receivedAtMs):null;
  return {e,arm:{...displayJoints(null,v),gripperOpeningM:v?.gripperOpeningM??null}};
 });
}
const armBase=(f:TwinFrame)=>f.preset.project.armCollisionProfile?.baseInMap;
const heightOf=(e:SceneEntity)=>e.kind==='amr'?0.225:e.kind==='coffee_machine'?1.125:e.kind==='arm'?1.25:e.kind==='cup'?(e.status?.startsWith('robot')?0.52:e.status?.startsWith('customer')?0.8:1.0):1.05;
/** Changes when the project, the navigation scene, a layer, the selection, the set of objects (and how each is drawn) or the arm's display source
 * changes; never when only a pose or a joint angle does. Pure. */
export function structureKey(f:TwinFrame,vs:ViewState):string{
 const p=f.preset.project,chain=!!armBase(f);
 return JSON.stringify([p.id,p.revision,p.world.width,p.world.height,f.navigation?.sceneDigest??null,vs.layers,vs.selected,
  drawn(f).map(({e,arm})=>[e.id,e.kind,e.source,!!e.pose3d,arm&&[arm.source,arm.frozen,chain&&!!arm.jointsRad]])]);
}
/** The exact poses of a frame (no buffer): what update() shows, and the base the workspace's sample buffer overrides. Pure. */
export function posesOf(f:TwinFrame):TwinPoses{
 const out:TwinPoses={arms:{},bodies:{}},chain=!!armBase(f);
 for(const {e,arm} of drawn(f)){
  if(e.kind==='amr')out.bodies[e.id]={positionM:[e.x,e.y,e.pose3d?.z??0],quaternionXyzw:rosQuat(e.yawRad??0,e.pose3d?.pitchRad??0,e.pose3d?.rollRad??0)};
  else if(arm?.jointsRad&&chain)out.arms[e.id]={jointsRad:arm.jointsRad,gripperOpeningM:arm.gripperOpeningM};
 }
 return out;
}
/** Remove and free every child: geometries and materials are not shared across rebuilds. */
const free=(g:THREE.Object3D)=>{for(const c of [...g.children]){g.remove(c);c.traverse(o=>{const m=o as THREE.Mesh,mt=m.material as THREE.Material|THREE.Material[]|undefined;m.geometry?.dispose();for(const x of Array.isArray(mt)?mt:mt?[mt]:[])x.dispose();});}};
export function mountTwin3d(host:HTMLElement,onSelect:(id:string)=>void,onFail:()=>void):Twin3d|null {
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{return null;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','3D twin view. Use the entity list to select objects.');canvas.dataset.rebuilds='0';
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();queueMicrotask(onFail);});
 host.replaceChildren(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,0.1,200),controls=new OrbitControls(camera,canvas);
 controls.enableDamping=false;controls.maxPolarAngle=Math.PI*0.48;
 scene.add(new THREE.HemisphereLight(0xc9e8ff,0x24373b,2.6));
 // one directional light casts soft shadows; its shadow camera covers the floor (set on each rebuild)
 const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun,sun.target);
 const world=new THREE.Group(),overlays=new THREE.Group();scene.add(world,overlays);
 /** Per drawn entity: its object, the height of its centre above the base origin (AMR), and the arm chain to re-pose. */
 const objs=new Map<string,{obj:THREE.Object3D;c:number;chain?:THREE.Group}>();
 let key='',rebuilds=0,lf:TwinFrame|null=null,lvs:ViewState|null=null,floor='';
 const mat=(color:number,o:{wire?:boolean;emissive?:boolean}={})=>new THREE.MeshStandardMaterial({color,wireframe:!!o.wire,emissive:o.emissive?LIME:0x000000,emissiveIntensity:o.emissive?0.6:0,roughness:0.7});
 const render=()=>{renderer.render(scene,camera);canvas.dataset.camera=camera.position.toArray().map(v=>v.toFixed(3)).join(',');};
 // size from wherever the canvas lives now: the stage element is replaced on every workspace render
 const resize=()=>{const p=canvas.parentElement,w=p?.clientWidth||640,h=p?.clientHeight||420;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 const ro=new ResizeObserver(resize);ro.observe(host);controls.addEventListener('change',render);
 const pick=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  const hit=ray.intersectObjects(world.children,true).find(h=>h.object.userData.entityId);if(hit)onSelect(String(hit.object.userData.entityId));};
 let down:[number,number]=[0,0];
 canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)pick(e);});
 const at=(x:number,y:number,z=0)=>new THREE.Vector3(x,z,-y);
 const build=(f:TwinFrame,vs:ViewState)=>{
  free(world);objs.clear();
  const w=f.preset.project.world,m=Math.max(w.width,w.height);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(w.width,w.height),mat(0x101e25));ground.rotation.x=-Math.PI/2;ground.position.copy(at(w.width/2,w.height/2));world.add(ground);
  const grid=new THREE.GridHelper(m,m,0x4a626a,0x2c424b);grid.position.copy(at(m/2,m/2,0.001));world.add(grid);
  for(const o of w.obstacles){const b=new THREE.Mesh(new THREE.BoxGeometry(o.width,0.9,o.height),mat(0x29414b));b.position.copy(at(o.x+o.width/2,o.y+o.height/2,0.45));world.add(b);}
  for(const o of f.navigation?.world.obstacles??[])world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(o.verticesM.map(v=>at(v[0]!,v[1]!,0.04))),new THREE.LineBasicMaterial({color:0xf0b45a})));
  // Tables are schematic context, not collision geometry; runtime obstacles and footprint overlays remain the model.
  for(const p of w.points.filter(p=>p.kind==='table')){const table=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.08,20),mat(0x43585d));table.position.copy(at(p.x,p.y,0.72));world.add(table);}
  const base=armBase(f);
  for(const {e,arm} of drawn(f)){
   const on=e.id===vs.selected;
   // an arm with joint telemetry and a base pose is drawn as its joint chain (what the runtime last reported, never extrapolated); otherwise the single cylinder below
   if(arm?.jointsRad&&base){
    const chain=armChain(armFrames(ARM_JOINTS,arm.jointsRad),mat(NAVY+0x101010,{wire:arm.source!=='observed'||arm.frozen,emissive:on}));
    const [px,py,pz]=base.position as [number,number,number],[qx,qy,qz,qw]=base.quaternionXyzw as [number,number,number,number];
    chain.quaternion.set(qx,qy,qz,qw);chain.position.set(px,py,pz);
    const holder=new THREE.Group();holder.rotation.x=-Math.PI/2;holder.add(chain); // ROS (z up) -> scene (y up): (x, y, z) -> (x, z, -y); the chain sits at the base pose in the ROS map
    holder.traverse(o=>{o.userData.entityId=e.id;});world.add(holder);objs.set(e.id,{obj:holder,c:0,chain});continue;
   }
   const geo=e.kind==='amr'?new THREE.CylinderGeometry(0.3,0.3,0.45,24):e.kind==='coffee_machine'?new THREE.BoxGeometry(0.4,0.45,0.3):e.kind==='arm'?new THREE.CylinderGeometry(0.09,0.12,0.7,16):e.kind==='cup'?new THREE.CylinderGeometry(0.05,0.04,0.12,16):new THREE.BoxGeometry(0.25,0.3,0.25);
   const mesh=new THREE.Mesh(geo,mat(e.kind==='amr'?0xd3dcd3:e.kind==='cup'?0xf5f0e6:NAVY+0x101010,{wire:e.source==='unknown'||e.source==='derived',emissive:on}));
   // a 3D plant: the body centre sits above the base origin by its height less the wheel radius (the base origin's height when it stands level)
   const wheel=f.navigation?.robots.find(r=>r.robotId===e.id)?.model.kinematics.wheelRadiusM??0.09;
   mesh.userData.entityId=e.id;world.add(mesh);objs.set(e.id,{obj:mesh,c:heightOf(e)-(e.pose3d?wheel:0)});
  }
  if(vs.layers.frames)world.add(new THREE.AxesHelper(0.6));
  world.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=o!==ground;o.receiveShadow=true;}});
  sun.position.set(w.width/2+3,8,-w.height/2+4);sun.target.position.set(w.width/2,0,-w.height/2);
  const sc=sun.shadow.camera;sc.left=sc.bottom=-m;sc.right=sc.top=m;sc.near=0.5;sc.far=40;sc.updateProjectionMatrix();
  canvas.dataset.rebuilds=String(++rebuilds);
 };
 /** The plan overlays follow the poses shown (a footprint never lags or leads its body). */
 const drawOverlays=(f:TwinFrame,vs:ViewState,p:TwinPoses)=>{
  free(overlays);
  const g:TwinFrame=f.view?{...f,view:{...f.view,entities:f.view.entities.map(r=>{const b=p.bodies[r.id];return b?{...r,pose:{...r.pose,x:b.positionM[0],y:b.positionM[1],yawRad:yawOf(b.quaternionXyzw)}}:r;})}}:f;
  for(const sh of overlayShapes(g,vs)){
   const pts=sh.points.map(([x,y])=>at(x,y,sh.z)),geo=new THREE.BufferGeometry().setFromPoints(pts);
   if(sh.layer==='path')overlays.add(new THREE.Line(geo,new THREE.LineDashedMaterial({color:LIME,dashSize:0.08,gapSize:0.06})).computeLineDistances());
   else overlays.add(sh.loop?new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:COLOR[sh.layer]})):new THREE.Line(geo,new THREE.LineBasicMaterial({color:COLOR[sh.layer]})));
  }
  if(vs.layers.frames)for(const r of g.view?.entities??[]){const ax=new THREE.AxesHelper(0.4);ax.position.copy(at(r.pose.x,r.pose.y,0.5));ax.rotation.y=r.pose.yawRad;overlays.add(ax);}
 };
 const pose=(p:TwinPoses)=>{
  for(const [id,b] of Object.entries(p.bodies)){const o=objs.get(id);if(!o||o.chain)continue;const pl=placeBody(b.positionM,b.quaternionXyzw,o.c);o.obj.position.set(...pl.position);o.obj.quaternion.set(...pl.quaternion);}
  for(const [id,a] of Object.entries(p.arms)){const o=objs.get(id);if(o?.chain&&a.jointsRad.length===ARM_JOINTS.length)poseArmChain(o.chain,armFrames(ARM_JOINTS,a.jointsRad));}
  if(lf&&lvs)drawOverlays(lf,lvs,p);
  render();
 };
 const home=()=>{if(!lf)return;const w=lf.preset.project.world,m=Math.max(w.width,w.height);camera.position.set(w.width/2,m*0.9,w.height*0.4+m*0.6);controls.target.set(w.width/2,0,-w.height/2);controls.update();render();};
 return {canvas,pose,home,
  attach(next){if(canvas.parentElement!==next)next.replaceChildren(canvas);ro.disconnect();ro.observe(next);resize();},
  update(f,vs){
   lf=f;lvs=vs;
   const k=structureKey(f,vs);if(k!==key){key=k;build(f,vs);}
   const w=f.preset.project.world,size=`${w.width}x${w.height}`;if(size!==floor){floor=size;home();}
   // objects without a pose of their own (cups, a cylinder arm, machines) move with the frame
   for(const {e} of drawn(f)){const o=objs.get(e.id);if(o&&e.kind!=='amr'&&!o.chain)o.obj.position.copy(at(e.x,e.y,heightOf(e)));}
   pose(posesOf(f));
  },
  fit(id){
   const o=id?objs.get(id)?.obj:undefined,box=new THREE.Box3().setFromObject(o??world);if(box.isEmpty())return;
   const s=box.getBoundingSphere(new THREE.Sphere()),d=Math.max(s.radius,0.3)/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2),dir=camera.position.clone().sub(controls.target).normalize();
   controls.target.copy(s.center);camera.position.copy(s.center).addScaledVector(dir,d);controls.update();render();
  },
  dispose(){free(world);free(overlays);objs.clear();sun.dispose();ro.disconnect();controls.dispose();renderer.dispose();canvas.remove();},
 };
}
