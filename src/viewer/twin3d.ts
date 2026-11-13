// Optional WebGL view of the same TwinFrame/ViewState the 2D plan draws. Read-only. The scene is kept: update() rebuilds it only when the scene itself
// (sceneKey: project, world, navigation scene, layers, selection) changes; an object whose own drawing changes (objectKeys: it appears or goes, its source,
// a cup entering or leaving the plant's report, the arm's display source) is redrawn alone (dataset.redraws); otherwise it moves what is there; pose() only changes transforms. Renders on demand: the workspace drives pose() from an
// animation frame only while live samples arrive and reduced motion is not requested. Any WebGL failure returns null or calls onFail and the
// workspace stays on the 2D plan with the same selection. An xArm 6 (MuJoCo plant) is drawn from its vendor meshes once they are loaded (D51), as its joint
// chain until then or when they cannot be used; the swap happens in place, without a rebuild or a camera move.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {droppedPlantCups,observedSegments,sceneEntities,type SceneEntity,type TwinFrame,type ViewState} from '../twin/scene';
import {amrFootprint,assetOf} from '../twin/amr';
import {footprintInMap} from '../twin/lidar';
import {placeBody,rosQuat,yawOf} from '../twin/pose3d';
import {armFrames,type ArmJointDef} from '../twin/arm/arm-frames';
import {armJointsView,armModelFor,displayJoints} from '../twin/arm/arm-telemetry';
import {armChain,poseArmChain} from './arm-chain';
import {armJoints,cloneArmMeshes,loadArmMeshes,poseArmMeshes,type ArmMeshSet} from './arm-mesh';
import armComponent from '../../fixtures/engineering/arm-ref-3d-v1/component.json' with {type:'json'};
import xarmComponent from '../../fixtures/engineering/xarm6-g2-v1/component.json' with {type:'json'};
import xarmPhysics from '../../fixtures/engineering/xarm6-g2-v1/physics.json' with {type:'json'};
import xarmManifest from '../../fixtures/engineering/xarm6-g2-v1/manifest.json' with {type:'json'};
import xarmLayout from '../../fixtures/engineering/xarm6-g2-v1/cell-layout.json' with {type:'json'};
const XARM='xarm6-g2-v1',JOINTS:Record<ReturnType<typeof armModelFor>,ArmJointDef[]>={'arm-ref-3d-v1':armComponent.joints as unknown as ArmJointDef[],[XARM]:armJoints(xarmComponent,xarmPhysics)};
/** The Lab serves the meshes from its own origin (public/, beside the vendor NOTICE), never from the runtime. */
const XARM_BLOBS='/fixtures/xarm6-g2-v1/blobs/';
type Pose7={positionM:[number,number,number];quaternionXyzw:[number,number,number,number]};
/** Transforms only. `bodies`: an AMR's base origin in the ROS map (z up; z 0 for a planar plant) and its ROS orientation. `arms`: the joints shown and the
 * measured gripper opening. `cups`: the cups drawn where the plant reports them (map frame, cup centre). */
export interface TwinPoses {arms:Record<string,{jointsRad:number[];gripperOpeningM:number|null}>;bodies:Record<string,Pose7>;cups?:Record<string,Pose7>}
export interface Twin3d {canvas:HTMLCanvasElement;/** Move into a re-rendered stage and size from it. */attach(host:HTMLElement):void;update(f:TwinFrame,vs:ViewState):void;pose(p:TwinPoses):void;
 /** Camera back to the preset's home framing: its arm cell (homeRegion), else the whole floor. */home():void;/** Frame one object, or the whole scene for null or an object not drawn. */fit(entityId:string|null):void;dispose():void}
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
/** The model revision the run reports (its arm trace, else the run project's arm profile, which the runtime checks against its fixture). */
const runRevision=(f:TwinFrame)=>f.report?.coffee?.armTrace?.modelRevision??f.preset.project.armCollisionProfile?.modelRevision??null;
/** What the scene draws: placed entities (no jobs), and for an arm the joints it shows (observed, else commanded; frozen while stale), the model its
 * provider runs and whether that model is drawn from meshes (the xArm, when the Lab's fixture revision is the run's). */
function drawn(f:TwinFrame){
 return sceneEntities(f).filter(e=>Number.isFinite(e.x)&&e.kind!=='job').map(e=>{
  if(e.kind!=='arm')return {e,arm:null};
  const s=f.samples?.[e.id],v=s?armJointsView(s,f.nowMs??s.receivedAtMs):null,model=armModelFor(s?.providerId??''),run=runRevision(f);
  return {e,arm:{...displayJoints(null,v),gripperOpeningM:v?.gripperOpeningM??null,model,mesh:model===XARM&&(run===null||run===xarmManifest.modelRevision)}};
 });
}
const armBase=(f:TwinFrame)=>f.preset.project.armCollisionProfile?.baseInMap;
/** The home framing of a preset that asks for its arm cell (`view: 'arm_cell'`), as boxes in the map frame (m), derived from the scene, never written into the preset:
 * the arm over its base (0.45 m around it: the stand and the tray beside it; from 0.1 m below the base to 0.8 m above it, the arm standing up) and the docked robot at
 * each coffee pickup (0.45 m around it, for its 0.4 m radius; from the floor to 0.6 m, its cups on the tray). Null for any other preset (home shows the whole floor). Pure. */
export function homeRegion(f:TwinFrame):{min:[number,number,number];max:[number,number,number]}[]|null{
 const b=armBase(f)?.position;if(f.preset.view!=='arm_cell'||!b)return null;
 const M=0.45,around=(x:number,y:number,z0:number,z1:number)=>({min:[x-M,y-M,z0] as [number,number,number],max:[x+M,y+M,z1] as [number,number,number]});
 return [around(b[0]!,b[1]!,Math.max(0,b[2]!-0.1),b[2]!+0.8),...f.preset.project.world.points.filter(p=>p.kind==='coffee_pickup').map(p=>around(p.x,p.y,0,0.6))];
}
/** One mesh load per model per page: the parsed geometry is kept and shared by every drawing of it. */
interface MeshLoad {set:ArmMeshSet|null;error:string|null;ms:number|null;done:Promise<void>}
const loads=new Map<string,MeshLoad>();
function meshLoad():MeshLoad{
 let l=loads.get(XARM);if(l)return l;
 const t0=performance.now(),x:MeshLoad={set:null,error:null,ms:null,done:Promise.resolve()};
 x.done=loadArmMeshes(xarmComponent,xarmPhysics,async sha=>{const r=await fetch(`${XARM_BLOBS}${sha}.stl`);if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.arrayBuffer();},new THREE.MeshStandardMaterial())
  .then(s=>{x.set=s;},(e:unknown)=>{x.error=e instanceof Error?e.message:String(e);}).finally(()=>{x.ms=performance.now()-t0;});
 loads.set(XARM,l=x);return l;
}
/** The page's loaded mesh set (the parsed geometry every drawing shares), or null: read by the browser test that checks nothing accumulates on it. */
export const cachedArmMeshes=():ArmMeshSet|null=>loads.get(XARM)?.set??null;
export interface ArmMeshIssue {entityId:string;code:'ARM_MODEL_REVISION_MISMATCH'|'ARM_MESH_UNAVAILABLE';lab?:string;run?:string;detail?:string}
/** Why an arm that has meshes is drawn as its joint chain instead (D51): the run reports another model revision than the Lab's fixture, or a mesh could not
 * be used. Both are notices: the run goes on. */
export function armMeshIssues(f:TwinFrame):ArmMeshIssue[]{
 if(!armBase(f))return [];
 return drawn(f).flatMap(({e,arm}):ArmMeshIssue[]=>{
  if(!arm?.jointsRad||arm.model!==XARM)return [];
  const run=runRevision(f),err=loads.get(XARM)?.error;
  return !arm.mesh?[{entityId:e.id,code:'ARM_MODEL_REVISION_MISMATCH',lab:xarmManifest.modelRevision,run:run!}]:err?[{entityId:e.id,code:'ARM_MESH_UNAVAILABLE',detail:err}]:[];
 });
}
const heightOf=(e:SceneEntity)=>e.kind==='amr'?0.225:e.kind==='coffee_machine'?1.125:e.kind==='arm'?1.25:e.kind==='cup'?(e.status?.startsWith('robot')?0.52:e.status?.startsWith('customer')?0.8:1.0):1.05;
/** What rebuilds the whole scene: the project and its world, the navigation scene, a layer, the selection. Pure. */
export const sceneKey=(f:TwinFrame,vs:ViewState):string=>{const p=f.preset.project;return JSON.stringify([p.id,p.revision,p.world.width,p.world.height,f.navigation?.sceneDigest??null,vs.layers,vs.selected]);};
/** How each drawn object looks (never its pose or joint angles): a changed entry redraws that object alone. Pure. */
export function objectKeys(f:TwinFrame):Map<string,string>{
 const chain=!!armBase(f);
 return new Map(drawn(f).map(({e,arm})=>[e.id,JSON.stringify([e.kind,e.source,!!e.pose3d,!!e.plant,arm&&[arm.source,arm.frozen,chain&&!!arm.jointsRad,arm.model,arm.mesh]])]));
}
/** Changes when the scene or any object's drawing changes; never when only a pose or a joint angle does. Pure. */
export const structureKey=(f:TwinFrame,vs:ViewState):string=>JSON.stringify([sceneKey(f,vs),[...objectKeys(f)]]);
/** The exact poses of a frame (no buffer): what update() shows, and the base the workspace's sample buffer overrides. Pure. */
export function posesOf(f:TwinFrame):TwinPoses{
 const out:Required<TwinPoses>={arms:{},bodies:{},cups:{}},chain=!!armBase(f);
 for(const {e,arm} of drawn(f)){
  if(e.kind==='amr')out.bodies[e.id]={positionM:[e.x,e.y,e.pose3d?.z??0],quaternionXyzw:rosQuat(e.yawRad??0,e.pose3d?.pitchRad??0,e.pose3d?.rollRad??0)};
  else if(arm?.jointsRad&&chain)out.arms[e.id]={jointsRad:arm.jointsRad,gripperOpeningM:arm.gripperOpeningM};
  else if(e.plant)out.cups[e.id]=e.plant;
 }
 return out;
}
/** Remove and free an object (or every child of a group): geometries and materials are not shared across rebuilds, except the arm meshes' parsed geometry (`userData.shared`), kept for the page. */
const freeOne=(c:THREE.Object3D)=>{c.removeFromParent();c.traverse(o=>{const m=o as THREE.Mesh,mt=m.material as THREE.Material|THREE.Material[]|undefined;if(!m.userData.shared)m.geometry?.dispose();for(const x of Array.isArray(mt)?mt:mt?[mt]:[])x.dispose();});};
const free=(g:THREE.Object3D)=>{for(const c of [...g.children])freeOne(c);};
/** The overlays as drawn: footprint and safety outlines in their entity's own frame (`anchored`: they move with its body, never rebuilt for a pose),
 * the rest in the map. Pure. */
export function anchoredOverlays(f:TwinFrame,vs:ViewState):(OverlayShape&{anchored:boolean})[]{
 const at=new Map((f.view?.entities??[]).filter(r=>[r.pose.x,r.pose.y,r.pose.yawRad].every(Number.isFinite)).map(r=>[r.id,r.pose]));
 return overlayShapes(f,vs).map(sh=>{
  const p=at.get(sh.entityId);if(!p||(sh.layer!=='footprint'&&sh.layer!=='safety'))return {...sh,anchored:false};
  const c=Math.cos(p.yawRad),s=Math.sin(p.yawRad);
  return {...sh,anchored:true,points:sh.points.map(([x,y])=>{const dx=x-p.x,dy=y-p.y;return [c*dx+s*dy,-s*dx+c*dy] as [number,number];})};
 });
}
const r6=(_k:string,v:unknown)=>typeof v==='number'?Math.round(v*1e6)/1e6:v;
/** An arm as drawn: placed at its base (`at`), dressed as its joint chain or its meshes; `q`/`opening` are the last pose, for a swap. */
interface ArmDraw {id:string;at:THREE.Group;joints:ArmJointDef[];look:{wire:boolean;emissive:boolean};wantMesh:boolean;chain?:THREE.Group;mesh?:ArmMeshSet;q:number[];opening:number|null}
/** `onArmMesh`: the arm's drawing changed by itself (meshes ready or failed), so the page can update its problems list. */
export function mountTwin3d(host:HTMLElement,onSelect:(id:string)=>void,onFail:()=>void,onArmMesh:()=>void=()=>{}):Twin3d|null {
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{return null;}
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const canvas=renderer.domElement;canvas.setAttribute('aria-label','3D twin view. Use the entity list to select objects.');canvas.dataset.rebuilds='0';canvas.dataset.redraws='0';canvas.dataset.overlayBuilds='0';
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();queueMicrotask(onFail);});
 host.replaceChildren(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,0.1,200),controls=new OrbitControls(camera,canvas);
 controls.enableDamping=false;controls.maxPolarAngle=Math.PI*0.48;
 scene.add(new THREE.HemisphereLight(0xc9e8ff,0x24373b,2.6));
 // one directional light casts soft shadows; its shadow camera covers the floor (set on each rebuild)
 const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun,sun.target);
 const world=new THREE.Group(),overlays=new THREE.Group();scene.add(world,overlays);
 /** Per drawn entity: its object, the height of its centre above the base origin (AMR), and the arm chain to re-pose. */
 const objs=new Map<string,{obj:THREE.Object3D;c:number;arm?:ArmDraw}>();
 let key='',okeys=new Map<string,string>(),rebuilds=0,redraws=0,lf:TwinFrame|null=null,floor='',okey='',overlayBuilds=0,gone=false;
 /** Per entity: the overlay group that moves with its body, and its path line whose first point is the body. */
 const anchors=new Map<string,THREE.Group>(),heads=new Map<string,THREE.Line>();
 const mat=(color:number,o:{wire?:boolean;emissive?:boolean}={})=>new THREE.MeshStandardMaterial({color,wireframe:!!o.wire,emissive:o.emissive?LIME:0x000000,emissiveIntensity:o.emissive?0.6:0,roughness:0.7});
 /** A dataset attribute is written only when its value changed (pose() runs every animation frame). */
 const put=(k:string,v:string)=>{if(canvas.dataset[k]!==v)canvas.dataset[k]=v;};
 /** For tests and evidence: the share of the viewport's height the arm takes (its bounding box projected), and whether the whole floor is in view. */
 const framing=()=>{
  const ndc=(p:THREE.Vector3)=>p.clone().project(camera),arm=[...objs.values()].find(o=>o.arm)?.obj;
  if(arm){const b=new THREE.Box3().setFromObject(arm);if(!b.isEmpty()){const ys=[0,1,2,3,4,5,6,7].map(i=>ndc(new THREE.Vector3(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z)).y);put('armFrac',((Math.min(1,Math.max(...ys))-Math.max(-1,Math.min(...ys)))/2).toFixed(3));}}
  const w=lf?.preset.project.world;if(w)put('floorInView',String([[0,0],[w.width,0],[0,w.height],[w.width,w.height]].every(([x,y])=>{const q=ndc(at(x!,y!));return Math.abs(q.x)<=1&&Math.abs(q.y)<=1;})));
 };
 const render=()=>{renderer.render(scene,camera);put('camera',camera.position.toArray().map(v=>v.toFixed(3)).join(','));put('geometries',String(renderer.info.memory.geometries));framing();};
 // size from wherever the canvas lives now: the stage element is replaced on every workspace render
 const resize=()=>{const p=canvas.parentElement,w=p?.clientWidth||640,h=p?.clientHeight||420;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();render();};
 const ro=new ResizeObserver(resize);ro.observe(host);controls.addEventListener('change',render);
 const pick=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
  const hit=ray.intersectObjects(world.children,true).find(h=>h.object.userData.entityId);if(hit)onSelect(String(hit.object.userData.entityId));};
 let down:[number,number]=[0,0];
 canvas.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])<5)pick(e);});
 const at=(x:number,y:number,z=0)=>new THREE.Vector3(x,z,-y);
 /** Dress an arm as its meshes (a copy sharing the loaded geometry) or as its joint chain, never a mix, posed at its last joints. */
 const dress=(a:ArmDraw,set:ArmMeshSet|null)=>{
  free(a.at);const m=mat(set?0xc5ccd0:NAVY+0x101010,a.look);
  if(set){a.mesh=cloneArmMeshes(set,m);a.chain=undefined;a.at.add(a.mesh.group);poseArmMeshes(a.mesh,armFrames(a.joints,a.q),a.opening);}
  else{a.chain=armChain(armFrames(a.joints,a.q),m);a.mesh=undefined;a.at.add(a.chain);}
  a.at.traverse(o=>{o.userData.entityId=a.id;if((o as THREE.Mesh).isMesh)o.castShadow=o.receiveShadow=true;});
 };
 const arms=()=>[...objs.values()].flatMap(o=>o.arm?[o.arm]:[]);
 /** What the view shows of the arm and the cups, for tests and evidence: the drawing in use, its mesh links, the drive angle, each plant cup's map position. */
 /** Per pose (cheap); the fallback reason only when the drawing changes (a build or a finished load), off the animation path. */
 const fallback=()=>put('armFallback',lf?armMeshIssues(lf).map(i=>i.code).join(' '):'');
 const status=()=>{
  const a=arms()[0],l=loads.get(XARM),plant=[...objs].filter(([,o])=>o.obj.userData.plant);
  put('armModel',a?a.mesh?'mesh':'chain':'');put('armMeshLinks',String(a?.mesh?.links.length??0));put('armMeshMs',l?.ms==null?'':l.ms.toFixed(0));
  put('gripperRad',a?.mesh?(a.mesh.group.userData.driveRad as number).toFixed(4):'');
  put('cups',plant.length?JSON.stringify(Object.fromEntries(plant.map(([id,o])=>[id,[o.obj.position.x,-o.obj.position.z,o.obj.position.y].map(v=>Number(v.toFixed(4)))]))):'{}');
 };
 /** The meshes, or on any throw while dressing them the joint chain for good: the load is marked unusable (ARM_MESH_UNAVAILABLE), never an arm with no drawing. */
 const dressMeshes=(a:ArmDraw,l:MeshLoad)=>{
  try{dress(a,l.set);}catch(e){l.error=`ARM_MESH_UNAVAILABLE:render (${e instanceof Error?e.message:String(e)})`;l.set=null;dress(a,null);}
 };
 /** Swap every arm waiting for these meshes in place once they are loaded (or report the failure): no rebuild, the camera stays. */
 const waiting=new Set<MeshLoad>();
 const await_=(l:MeshLoad)=>{if(waiting.has(l))return;waiting.add(l);void l.done.then(()=>{waiting.delete(l);if(gone)return;
  for(const a of arms())if(l.set&&a.wantMesh&&!a.mesh)dressMeshes(a,l);
  fallback();status();render();onArmMesh();});};
 /** One object as its frame describes it, added to the world (an arm: its chain or meshes; anything else: its schematic shape). */
 const drawOne=({e,arm}:ReturnType<typeof drawn>[number],f:TwinFrame,vs:ViewState)=>{
  const base=armBase(f);
  const on=e.id===vs.selected;
  // an arm with joint telemetry and a base pose is drawn as its joint chain (what the runtime last reported, never extrapolated); otherwise the single cylinder below
  if(arm?.jointsRad&&base){
   const a:ArmDraw={id:e.id,at:new THREE.Group(),joints:JOINTS[arm.model],look:{wire:arm.source!=='observed'||arm.frozen,emissive:on},wantMesh:arm.mesh,q:arm.jointsRad,opening:arm.gripperOpeningM};
   const [px,py,pz]=base.position as [number,number,number],[qx,qy,qz,qw]=base.quaternionXyzw as [number,number,number,number];
   a.at.quaternion.set(qx,qy,qz,qw);a.at.position.set(px,py,pz);
   const holder=new THREE.Group();holder.rotation.x=-Math.PI/2;holder.add(a.at); // ROS (z up) -> scene (y up): (x, y, z) -> (x, z, -y); the arm sits at the base pose in the ROS map
   world.add(holder);objs.set(e.id,{obj:holder,c:0,arm:a});
   // the meshes when they are loaded (once per page); the joint chain until then, and for good when they cannot be used
   const l=a.wantMesh?meshLoad():null;if(l?.set)dressMeshes(a,l);else dress(a,null);if(l&&!l.set&&!l.error)await_(l);
   return;
  }
  // a cup the plant reports: its own size (cell layout, assumed) at the plant's pose, set by pose(); any other cup: the schematic cup at its custodian
  const cup=xarmLayout.cup,geo=e.kind==='amr'?new THREE.CylinderGeometry(0.3,0.3,0.45,24):e.kind==='coffee_machine'?new THREE.BoxGeometry(0.4,0.45,0.3):e.kind==='arm'?new THREE.CylinderGeometry(0.09,0.12,0.7,16):e.kind==='cup'?e.plant?new THREE.CylinderGeometry(cup.radiusM,cup.radiusM,cup.heightM,20):new THREE.CylinderGeometry(0.05,0.04,0.12,16):new THREE.BoxGeometry(0.25,0.3,0.25);
  const mesh=new THREE.Mesh(geo,mat(e.kind==='amr'?0xd3dcd3:e.kind==='cup'?0xf5f0e6:NAVY+0x101010,{wire:e.source==='unknown'||e.source==='derived',emissive:on}));
  // a 3D plant: the body centre sits above the base origin by its height less the wheel radius (the base origin's height when it stands level)
  const wheel=f.navigation?.robots.find(r=>r.robotId===e.id)?.model.kinematics.wheelRadiusM??0.09;
  mesh.userData.entityId=e.id;mesh.userData.plant=!!e.plant;world.add(mesh);objs.set(e.id,{obj:mesh,c:heightOf(e)-(e.pose3d?wheel:0)});
 };
 const build=(f:TwinFrame,vs:ViewState)=>{
  free(world);objs.clear();
  const w=f.preset.project.world,m=Math.max(w.width,w.height);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(w.width,w.height),mat(0x101e25));ground.rotation.x=-Math.PI/2;ground.position.copy(at(w.width/2,w.height/2));world.add(ground);
  const grid=new THREE.GridHelper(m,m,0x4a626a,0x2c424b);grid.position.copy(at(m/2,m/2,0.001));world.add(grid);
  for(const o of w.obstacles){const b=new THREE.Mesh(new THREE.BoxGeometry(o.width,0.9,o.height),mat(0x29414b));b.position.copy(at(o.x+o.width/2,o.y+o.height/2,0.45));world.add(b);}
  for(const o of f.navigation?.world.obstacles??[])world.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(o.verticesM.map(v=>at(v[0]!,v[1]!,0.04))),new THREE.LineBasicMaterial({color:0xf0b45a})));
  // Tables are schematic context, not collision geometry; runtime obstacles and footprint overlays remain the model.
  for(const p of w.points.filter(p=>p.kind==='table')){const table=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.45,0.08,20),mat(0x43585d));table.position.copy(at(p.x,p.y,0.72));world.add(table);}
  for(const d of drawn(f))drawOne(d,f,vs);
  if(vs.layers.frames)world.add(new THREE.AxesHelper(0.6));
  world.traverse(o=>{if((o as THREE.Mesh).isMesh){o.castShadow=o!==ground;o.receiveShadow=true;}});
  sun.position.set(w.width/2+3,8,-w.height/2+4);sun.target.position.set(w.width/2,0,-w.height/2);
  const sc=sun.shadow.camera;sc.left=sc.bottom=-m;sc.right=sc.top=m;sc.near=0.5;sc.far=40;sc.updateProjectionMatrix();
  canvas.dataset.rebuilds=String(++rebuilds);fallback();status();
 };
 /** Rebuilt only when the overlay data changes (a new path, a longer trail, a layer), never for a pose: `canvas.dataset.overlayBuilds` counts it. */
 const drawOverlays=(f:TwinFrame,vs:ViewState)=>{
  const shapes=anchoredOverlays(f,vs),ids=vs.layers.frames?(f.view?.entities??[]).map(r=>r.id):[];
  const k=JSON.stringify([shapes.map(sh=>sh.layer==='path'?{...sh,points:sh.points.slice(1)}:sh),ids],r6);if(k===okey)return;okey=k;
  free(overlays);anchors.clear();heads.clear();
  const anchor=(id:string)=>{let g=anchors.get(id);if(!g){g=new THREE.Group();overlays.add(g);anchors.set(id,g);}return g;};
  for(const sh of shapes){
   const geo=new THREE.BufferGeometry().setFromPoints(sh.points.map(([x,y])=>sh.anchored?new THREE.Vector3(x,sh.z,-y):at(x,y,sh.z)));
   const line=sh.layer==='path'?new THREE.Line(geo,new THREE.LineDashedMaterial({color:LIME,dashSize:0.08,gapSize:0.06})).computeLineDistances():new (sh.loop?THREE.LineLoop:THREE.Line)(geo,new THREE.LineBasicMaterial({color:COLOR[sh.layer]}));
   (sh.anchored?anchor(sh.entityId):overlays).add(line);if(sh.layer==='path')heads.set(sh.entityId,line);
  }
  for(const id of ids){const ax=new THREE.AxesHelper(0.4);ax.position.y=0.5;anchor(id).add(ax);}
  canvas.dataset.overlayBuilds=String(++overlayBuilds);
 };
 /** Transforms only: bodies, the arm chain, the overlays anchored to a body and the first point of its path (moved in place). */
 const pose=(p:TwinPoses)=>{
  for(const [id,b] of Object.entries(p.bodies)){
   const o=objs.get(id),g=anchors.get(id),head=heads.get(id),[x,y]=b.positionM;
   if(o&&!o.arm){const pl=placeBody(b.positionM,b.quaternionXyzw,o.c);o.obj.position.set(...pl.position);o.obj.quaternion.set(...pl.quaternion);}
   if(g){g.position.set(x,0,-y);g.rotation.y=yawOf(b.quaternionXyzw);}
   if(head){
    const pos=head.geometry.getAttribute('position') as THREE.BufferAttribute,dist=head.geometry.getAttribute('lineDistance') as THREE.BufferAttribute|undefined;
    pos.setXYZ(0,x,pos.getY(0),-y);pos.needsUpdate=true;
    // the dashes keep their phase along the rest of the path: shift every later distance by the change of the first segment
    if(dist&&pos.count>1){const d=Math.hypot(pos.getX(1)-x,pos.getZ(1)+y)-dist.getX(1);for(let i=1;i<dist.count;i++)dist.setX(i,dist.getX(i)+d);dist.needsUpdate=true;}
   }
  }
  for(const [id,p0] of Object.entries(p.arms)){const a=objs.get(id)?.arm;if(!a||p0.jointsRad.length!==a.joints.length)continue;
   a.q=p0.jointsRad;a.opening=p0.gripperOpeningM;const fr=armFrames(a.joints,a.q);
   if(a.mesh)poseArmMeshes(a.mesh,fr,a.opening);else if(a.chain)poseArmChain(a.chain,fr);// the fingers follow the measured opening only
  }
  for(const [id,c] of Object.entries(p.cups??{})){const o=objs.get(id);if(o?.obj.userData.plant){const pl=placeBody(c.positionM,c.quaternionXyzw,0);o.obj.position.set(...pl.position);o.obj.quaternion.set(...pl.quaternion);}}
  status();render();
 };
 const home=()=>{if(!lf)return;const w=lf.preset.project.world,m=Math.max(w.width,w.height);camera.position.set(w.width/2,m*0.9,w.height*0.4+m*0.6);controls.target.set(w.width/2,0,-w.height/2);
  const r=homeRegion(lf);
  if(r){// the same viewing direction, moved in until every corner of the region's boxes just fits (98 % of the viewport)
   const corners=r.flatMap(q=>[0,1,2,3,4,5,6,7].map(i=>at(i&1?q.max[0]:q.min[0],i&2?q.max[1]:q.min[1],i&4?q.max[2]:q.min[2])));
   const box=new THREE.Box3().setFromPoints(corners),c=box.getCenter(new THREE.Vector3()),dir=camera.position.clone().sub(controls.target).normalize();
   const fits=(d:number)=>{camera.position.copy(c).addScaledVector(dir,d);camera.lookAt(c);camera.updateMatrixWorld();return corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<=0.98&&Math.abs(q.y)<=0.98&&q.z<1;});};
   let lo=0.5,hi=box.getBoundingSphere(new THREE.Sphere()).radius/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2)*2;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(fits(mid))hi=mid;else lo=mid;}
   fits(hi);controls.target.copy(c);
  }
  controls.update();render();};
 return {canvas,pose,home,
  attach(next){if(canvas.parentElement!==next)next.replaceChildren(canvas);ro.disconnect();ro.observe(next);resize();},
  update(f,vs){
   lf=f;put('plantCupsDropped',String(droppedPlantCups(f).length));
   const k=sceneKey(f,vs),o=objectKeys(f);
   if(k!==key){key=k;okeys=o;build(f,vs);}
   else{// the scene stands: only an object whose drawing changed is redrawn (a cup entering the plant's report, a source going stale)
    const changed=[...new Set([...okeys.keys(),...o.keys()])].filter(id=>okeys.get(id)!==o.get(id));okeys=o;
    if(changed.length){for(const id of changed){const x=objs.get(id);if(x){freeOne(x.obj);objs.delete(id);}}
     for(const d of drawn(f))if(changed.includes(d.e.id)){drawOne(d,f,vs);objs.get(d.e.id)?.obj.traverse(m=>{if((m as THREE.Mesh).isMesh){m.castShadow=true;m.receiveShadow=true;}});}
     canvas.dataset.redraws=String(redraws+=changed.length);fallback();status();}
   }
   // the home framing on a new floor or a preset that frames something else (its arm cell)
   const w=f.preset.project.world,size=`${w.width}x${w.height} ${f.preset.view??''}`;if(size!==floor){floor=size;home();}
   // objects without a pose of their own (cups, a cylinder arm, machines) move with the frame
   for(const {e} of drawn(f)){const o=objs.get(e.id);if(o&&e.kind!=='amr'&&!o.arm&&!e.plant)o.obj.position.copy(at(e.x,e.y,heightOf(e)));}
   drawOverlays(f,vs);pose(posesOf(f));
  },
  fit(id){
   const o=id?objs.get(id)?.obj:undefined,box=new THREE.Box3().setFromObject(o??world);if(box.isEmpty())return;
   const s=box.getBoundingSphere(new THREE.Sphere()),d=Math.max(s.radius,0.3)/Math.sin(THREE.MathUtils.degToRad(camera.fov)/2),dir=camera.position.clone().sub(controls.target).normalize();
   controls.target.copy(s.center);camera.position.copy(s.center).addScaledVector(dir,d);controls.update();render();
  },
  // the shared geometry stays parsed in the page cache, but its GPU buffers (and this renderer's dispose listeners on it) go with this view; a later view re-uploads it
  dispose(){gone=true;loads.get(XARM)?.set?.group.traverse(o=>(o as THREE.Mesh).geometry?.dispose());free(world);free(overlays);objs.clear();anchors.clear();heads.clear();sun.dispose();ro.disconnect();controls.dispose();renderer.dispose();canvas.remove();},
 };
}
