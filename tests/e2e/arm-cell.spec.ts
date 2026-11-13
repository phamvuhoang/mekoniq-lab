import {test,expect,type Page} from '@playwright/test';
// U06 fix round 2, in a real browser without a runtime: the 3D view mounted alone with the mujoco-coffee preset (arm-cell framing) and synthetic mujoco_arm samples.
// The MuJoCo cell's supports (the nozzle stand and the tray of the fixture's cell layout, placed through baseInMap) and an illustrative mount under the arm's base;
// cups resting on them; nothing new for another arm; the arm-cell framing computed with the real viewport on a fresh mount, never over a camera the user moved.
// node scripts/test-mock-e2e.mjs arm-cell.spec.ts, or pnpm exec playwright test arm-cell.spec.ts (which starts pnpm dev).
import layout from '../../fixtures/engineering/xarm6-g2-v1/cell-layout.json' with {type:'json'};
const HOME=[-4.93613604879e-10,-1.14779631171,-0.324460234973,-3.14159266066,0.098539780113,7.05694566235e-09];
type V3=[number,number,number];type Box={min:V3;max:V3};
type Drawn={supports:(Box&{id:string})[];mount:Box|null;cups:Record<string,Box>};
type Opts={q?:number[];cup?:V3|null;provider?:string;yawRad?:number;width?:number};
/** Rotate v by a yaw about the map's z, then add the base: what baseInMap does to a point of the arm-base frame (a rotation about z only here). */
const toMap=(v:readonly number[],base:readonly number[],yaw=0):V3=>[base[0]!+Math.cos(yaw)*v[0]!-Math.sin(yaw)*v[1]!,base[1]!+Math.sin(yaw)*v[0]!+Math.cos(yaw)*v[1]!,base[2]!+v[2]!];
const BASE=[2.65,0.65,0.7];
async function mount(page:Page){
 await page.goto('/');
 await page.evaluate(async()=>{
  const [t3,{presets},{defaultLayers}]=await Promise.all([import('/src/viewer/twin3d.ts' as string),import('/src/scenarios/catalog.ts' as string),import('/src/twin/overlays.ts' as string)]) as [typeof import('../../src/viewer/twin3d'),typeof import('../../src/scenarios/catalog'),typeof import('../../src/twin/overlays')];
  const host=document.createElement('div');host.id='u06';host.style.cssText='position:fixed;inset:0 auto auto 0;width:1100px;height:620px;z-index:99999;background:#0b1418';document.body.append(host);
  const w=window as unknown as Record<string,unknown>;let v=t3.mountTwin3d(host,()=>{},()=>{w.webglFailed=true;})!,seq=0;
  // as the workspace does (mountTwin3d, then paint3d at once): a fresh view and its first frame in the same task, before its first resize
  w.remount=(o:unknown)=>{v.dispose();v=t3.mountTwin3d(host,()=>{},()=>{})!;(w.draw as (o:unknown)=>unknown)(o);};w.home=()=>v.home();
  w.resize=(width:number)=>{host.style.width=`${width}px`;};
  w.draw=(o:{q:number[];cup:number[]|null;provider:string;yawRad:number})=>{
   const p=structuredClone(presets.find(x=>x.id==='mujoco-coffee')!.project),prof=p.armCollisionProfile!;prof.baseInMap.quaternionXyzw=[0,0,Math.sin(o.yawRad/2),Math.cos(o.yawRad/2)];
   const preset={...presets.find(x=>x.id==='mujoco-coffee')!,project:p},sim=String(++seq*1e8),now=performance.now();
   const base={schemaVersion:2,runId:'r',bootId:'b',seq:String(seq),simTimeNs:sim,observedAt:null,receivedMonotonicNs:'0',origin:'physics_sim',quality:'valid',reasonCodes:[],commanded:null,estimated:null,causationId:null,receivedAtMs:now,epochResetAtMs:null,providerId:o.provider};
   const samples:Record<string,unknown>={'arm-1':{...base,entityId:'arm-1',frameId:'arm_base',observed:{jointsRad:o.q}}};
   if(o.cup)samples['cup-1']={...base,entityId:'cup-1',frameId:'map',observed:{positionM:o.cup,quaternionXyzw:[0,0,0,1],restingOn:'stand',ownerKind:'cell',ownerId:'coffee-1'}};
   v.update({preset,report:null,nowMs:now,samples,view:{entities:[],coffee:{jobs:[],cups:[{cupId:'cup-1',ownerKind:'cell',ownerId:'coffee-1'}]}}} as never,{view:'3d',layers:defaultLayers(),selected:null});
   return {...v.canvas.dataset};
  };
  const canvas=()=>document.querySelector('#u06 canvas') as HTMLCanvasElement&{twinDrawn:()=>unknown;twinFraming:()=>unknown};
  w.drawn=()=>canvas().twinDrawn();w.framing=()=>canvas().twinFraming();
 });
}
const ev=<T,>(page:Page,f:string,...a:unknown[])=>page.evaluate(([f,a])=>(window as unknown as Record<string,(...x:unknown[])=>unknown>)[f as string]!(...(a as unknown[])),[f,a] as const) as Promise<T>;
const draw=(page:Page,o:Opts={})=>ev<DOMStringMap>(page,'draw',{q:o.q??HOME,cup:o.cup===undefined?null:o.cup,provider:o.provider??'mujoco_arm',yawRad:o.yawRad??0});
const centre=(b:Box)=>b.min.map((v,i)=>(v+b.max[i]!)/2) as V3;
const H=layout.cup.heightM,STAND=layout.nozzleStand,TRAY=layout.tray;

test('the MuJoCo cell shows its two supports and a mount; a cup at the pick stands on the stand, a cup at rest on the tray stands on the tray',async({page})=>{
 await mount(page);
 const pick=toMap(layout.grasp.pick.position,BASE);// the cup's centre at the pick: on the stand (0.10 + 0.05)
 expect((await draw(page,{cup:pick})).armSupports).toBe('2');
 let d=await ev<Drawn>(page,'drawn');
 expect(d.supports.map(s=>s.id).sort()).toEqual(['nozzle-stand','tray']);
 const stand=d.supports.find(s=>s.id==='nozzle-stand')!,tray=d.supports.find(s=>s.id==='tray')!;
 centre(stand).forEach((v,i)=>expect(v).toBeCloseTo(toMap(STAND.centerM,BASE)[i]!,3));centre(tray).forEach((v,i)=>expect(v).toBeCloseTo(toMap(TRAY.centerM,BASE)[i]!,3));
 expect(Math.abs(d.cups['cup-1']!.min[2]-stand.max[2]),'the cup\'s bottom on the stand\'s top face').toBeLessThan(0.001);
 // released: the cup rests on the tray at the place point (the place grasp pose itself is 2 mm above the tray: the release height)
 const rest=toMap([layout.grasp.place.position[0]!,layout.grasp.place.position[1]!,TRAY.centerM[2]!+TRAY.sizeM[2]!/2+H/2],BASE);
 await draw(page,{cup:rest});d=await ev<Drawn>(page,'drawn');
 expect(Math.abs(d.cups['cup-1']!.min[2]-d.supports.find(s=>s.id==='tray')!.max[2]),'the cup\'s bottom on the tray\'s top face').toBeLessThan(0.001);
 // the mount: from the floor to the base plane, under the base
 expect(d.mount!.min[2]).toBeCloseTo(0,3);expect(d.mount!.max[2]).toBeCloseTo(BASE[2]!,3);centre(d.mount!).slice(0,2).forEach((v,i)=>expect(v).toBeCloseTo(BASE[i]!,3));
});

test('the supports turn with a turned baseInMap',async({page})=>{
 await mount(page);await draw(page,{yawRad:Math.PI/2});
 const d=await ev<Drawn>(page,'drawn');
 centre(d.supports.find(s=>s.id==='nozzle-stand')!).forEach((v,i)=>expect(v).toBeCloseTo(toMap(STAND.centerM,BASE,Math.PI/2)[i]!,3));
 centre(d.supports.find(s=>s.id==='tray')!).forEach((v,i)=>expect(v).toBeCloseTo(toMap(TRAY.centerM,BASE,Math.PI/2)[i]!,3));
});

test('another arm (Webots): no supports and no mount',async({page})=>{
 await mount(page);expect((await draw(page,{provider:'webots_arm'})).armSupports).toBe('0');
 const d=await ev<Drawn>(page,'drawn');expect(d.supports).toEqual([]);expect(d.mount).toBeNull();
});

test('the arm-cell framing is computed with the real viewport on a fresh mount, and never over a camera the user moved',async({page})=>{
 type F={armFrac:number;floorInView:boolean;camera:string};
 const opts={q:HOME,cup:null,provider:'mujoco_arm',yawRad:0};
 await mount(page);await ev(page,'remount',opts);await page.waitForTimeout(300);// mounted and drawn in one task; then its first resize lands
 const fresh=await ev<F>(page,'framing');
 await ev(page,'home');const homed=await ev<F>(page,'framing');
 expect(fresh.camera,'a fresh mount frames exactly as home does at the real size').toBe(homed.camera);
 expect(fresh.armFrac).toBeGreaterThanOrEqual(1/3);expect(fresh.floorInView).toBe(false);
 // a fresh mount again (the workspace's 2D → 3D toggle): the same framing
 await ev(page,'remount',opts);await page.waitForTimeout(300);
 expect((await ev<F>(page,'framing')).camera).toBe(homed.camera);
 // the user orbits: later samples and a resize keep the user's camera
 const box=(await page.locator('#u06 canvas').boundingBox())!,[cx,cy]=[box.x+box.width/2,box.y+box.height/2];
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+150,cy+30,{steps:6});await page.mouse.up();
 const moved=(await ev<F>(page,'framing')).camera;expect(moved).not.toBe(homed.camera);
 for(let i=0;i<5;i++)await draw(page,{q:HOME.map((q,k)=>k===0?q+i*0.05:q)});
 await ev(page,'resize',1000);await page.waitForTimeout(300);
 expect((await ev<F>(page,'framing')).camera,'samples and a resize never reset a camera the user moved').toBe(moved);
 // zoom too
 await ev(page,'home');const h2=(await ev<F>(page,'framing')).camera;await page.mouse.move(cx,cy);await page.mouse.wheel(0,-300);await page.waitForTimeout(200);
 const zoomed=(await ev<F>(page,'framing')).camera;expect(zoomed).not.toBe(h2);await draw(page);await ev(page,'resize',1100);await page.waitForTimeout(300);
 expect((await ev<F>(page,'framing')).camera).toBe(zoomed);
});
