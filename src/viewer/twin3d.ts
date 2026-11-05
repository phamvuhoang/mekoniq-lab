// Optional WebGL view of the same TwinFrame/ViewState the 2D plan draws. Read-only; renders on demand (no animation loop), so reduced
// motion holds. Any WebGL failure returns null or calls onFail and the workspace stays on the 2D plan with the same selection.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {sceneEntities,type TwinFrame,type ViewState} from '../twin/scene';
import {amrFootprint,assetOf} from '../twin/amr';
export interface Twin3d {canvas:HTMLCanvasElement;/** Move into a re-rendered stage and size from it. */attach(host:HTMLElement):void;update(f:TwinFrame,vs:ViewState):void;dispose():void}
const LIME=0xb4f375,NAVY=0x182a33;
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
   for(const e of sceneEntities(f)){
    if(!Number.isFinite(e.x)||e.kind==='job')continue;
    const on=e.id===vs.selected,unknown=e.source==='unknown';
    const geo=e.kind==='amr'?new THREE.CylinderGeometry(0.3,0.3,0.45,24):e.kind==='coffee_machine'?new THREE.BoxGeometry(0.4,0.45,0.3):e.kind==='arm'?new THREE.CylinderGeometry(0.09,0.12,0.7,16):e.kind==='cup'?new THREE.CylinderGeometry(0.05,0.04,0.12,16):new THREE.BoxGeometry(0.25,0.3,0.25);
    const m=new THREE.Mesh(geo,mat(e.kind==='amr'?0xd3dcd3:e.kind==='cup'?0xf5f0e6:NAVY+0x101010,{wire:unknown||e.source==='derived',emissive:on}));
    const h=e.kind==='amr'?0.225:e.kind==='coffee_machine'?1.125:e.kind==='arm'?1.25:e.kind==='cup'?(e.status?.startsWith('robot')?0.52:e.status?.startsWith('customer')?0.8:1.0):1.05;
    m.position.copy(at(e.x,e.y,h));m.userData.entityId=e.id;dynamic.add(m);
   }
   for(const r of f.view?.entities??[]){
    if(vs.layers.path&&r.path.length){dynamic.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([[r.pose.x,r.pose.y],...r.path].map(([x,y])=>at(x!,y!,0.02))),new THREE.LineDashedMaterial({color:LIME,dashSize:0.08,gapSize:0.06})).computeLineDistances());}
    const poly=vs.layers.footprint?amrFootprint(assetOf(f.preset.project,f.preset.assets,r.id),r.pose):null;
    if(poly)dynamic.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(poly.map(([x,y])=>at(x,y,0.03))),new THREE.LineBasicMaterial({color:0x9dccff})));
    if(vs.layers.frames){const ax=new THREE.AxesHelper(0.4);ax.position.copy(at(r.pose.x,r.pose.y,0.5));ax.rotation.y=r.pose.yawRad;dynamic.add(ax);}
   }
   if(vs.layers.frames)dynamic.add(new THREE.AxesHelper(0.6));
   resize();
  },
  dispose(){ro.disconnect();controls.dispose();renderer.dispose();canvas.remove();},
 };
}
