// Review C01 F2: an opened saved/imported IR-SIM report draws only the compiled scene its own evidence names (sceneDigest), loaded from its own bundle;
// the scene of the last live run is never shown as another run's geometry, and a missing scene is unavailable with its reason (fail closed).
import 'fake-indexeddb/auto';
import {afterEach,expect,test,vi} from 'vitest';
import type {RunReport,TwinRuntime} from '../../src/scenarios/controls';
import type {TwinFrame} from '../../src/twin/scene';
import type {NavigationSceneV1} from '../../src/shared/navigation2d';
import type {SavedEvidence} from '../../src/reports/evidence';
import serveScene from '../../fixtures/engineering/serve-demo-v1/navigation-scene.json' with {type:'json'};
import {D,evidence,project,report} from '../support/navigation-report';
vi.stubGlobal('localStorage',{getItem:()=>'en',setItem:()=>{}});
vi.stubGlobal('innerWidth',600);
vi.stubGlobal('document',{querySelector:()=>null,getElementById:()=>null,activeElement:null});
const {TwinWorkspace}=await import('../../src/ui/workspace');
const {captureEvidence}=await import('../../src/reports/evidence');
const {boundNavigationScene}=await import('../../src/reports/navigation2d');
const workspaces:InstanceType<typeof TwinWorkspace>[]=[];
afterEach(()=>{for(const w of workspaces.splice(0))w.leave();});
const scene=(digest:string)=>({...structuredClone(serveScene),sceneDigest:digest}) as unknown as NavigationSceneV1;
const A=scene(D('a')),B=scene(D('b')),BUNDLE_A=D('1'),BUNDLE_B=D('2');
/** run A: its evidence names scene A, its manifest bundle A */
function runA():RunReport{const r=report({navigation2d:{...evidence(),sceneDigest:A.sceneDigest}});r.manifest.engineering={bundleDigest:BUNDLE_A,projectDigest:D('3')};return r;}
type Harness={frame():TwinFrame;busy:boolean;navigation:NavigationSceneV1|null;saved:SavedEvidence[]};
function open(bundles:Record<string,NavigationSceneV1>){
 const enc=new TextEncoder(),rt={paired:true,engineeringManifest:async(digest:string)=>{if(!bundles[digest])throw new Error('BUNDLE_NOT_FOUND');return {files:[{path:'navigation-scene.json',sha256:digest}]};},
  engineeringBlob:async(sha:string)=>enc.encode(JSON.stringify(bundles[sha]))} as unknown as TwinRuntime;
 const w=new TwinWorkspace(()=>{},rt),h=w as unknown as Harness;workspaces.push(w);
 const saved=captureEvidence(runA(),structuredClone(project) as never);
 Object.assign(h,{navigation:B,saved:[saved]});// scene B: what the last live create() loaded
 w.click('twin-open-evidence',saved.id);
 return {w,h};
}
test('the decision: a scene is shown only when it is the one the report evidence names; otherwise unavailable with the reason',()=>{
 expect(boundNavigationScene(runA(),A,false)).toEqual({scene:A,reason:null});
 expect(boundNavigationScene(runA(),B,false)).toEqual({scene:null,reason:'NAVIGATION_SCENE_MISMATCH'});
 expect(boundNavigationScene(runA(),null,false)).toEqual({scene:null,reason:'NAVIGATION_SCENE_UNAVAILABLE'});
 const old=report();delete (old as {navigation2d?:unknown}).navigation2d;
 expect(boundNavigationScene(old,A,false)).toEqual({scene:null,reason:'NAVIGATION_SCENE_UNBOUND'});// an archived report without evidence names no scene
 expect(boundNavigationScene(old,A,true)).toEqual({scene:A,reason:null});// a live run keeps the scene of the bundle it was created from
});
test('opening saved run A after a live run B shows scene A from bundle A, never scene B',async()=>{
 const {h}=open({[BUNDLE_A]:A,[BUNDLE_B]:B});
 expect(h.frame().navigation?.sceneDigest).not.toBe(B.sceneDigest);
 await vi.waitFor(()=>expect(h.frame().navigation?.sceneDigest).toBe(A.sceneDigest));
});
test('when bundle A is no longer on the runtime, the layers are unavailable with a visible reason, not scene B',async()=>{
 const {w,h}=open({[BUNDLE_B]:B});
 await new Promise(r=>setTimeout(r,10));
 expect(h.frame().navigation).toBeNull();
 expect(w.html()).toContain('NAVIGATION_SCENE_UNAVAILABLE');
});
test('a bundle whose scene is not the one the evidence names is refused as a mismatch',async()=>{
 const {w,h}=open({[BUNDLE_A]:B});
 await new Promise(r=>setTimeout(r,10));
 expect(h.frame().navigation).toBeNull();
 expect(w.html()).toContain('NAVIGATION_SCENE_MISMATCH');
});
