// D65: the 3D view keeps its scene; only a change of structure (project, navigation scene, layers, selection, the set of objects or the arm's display
// source) rebuilds it. A new pose or joint angle never does.
import {expect,test,vi} from 'vitest';
vi.hoisted(()=>{(globalThis as Record<string,unknown>).localStorage={getItem:()=>'en',setItem:()=>{}};});
import {posesOf,structureKey} from '../../src/viewer/twin3d';
import type {TwinFrame,ViewState} from '../../src/twin/scene';
import {defaultLayers} from '../../src/twin/overlays';
import {presets} from '../../src/scenarios/catalog';
import type {Held} from '../../src/twin/store';

const arm=(joints:number[]|null,seq=1):Held=>({schemaVersion:2,runId:'r',entityId:'arm-1',providerId:'mock_arm',bootId:'b',seq:String(seq),simTimeNs:String(seq*1e8),observedAt:null,receivedMonotonicNs:'0',frameId:'map',origin:'mock',quality:'valid',reasonCodes:[],
 commanded:null,observed:joints?{jointsRad:joints}:{},estimated:null,causationId:null,receivedAtMs:1000,epochResetAtMs:null});
const frame=(o:{x?:number;joints?:number[]|null;cups?:number}={}):TwinFrame=>({preset:presets.find(p=>p.id==='coffee')!,report:null,nowMs:1000,samples:{'arm-1':arm(o.joints===undefined?[0,-0.6,1.2,0,0.6,0]:o.joints)},
 view:{entities:[{id:'amr-1',kind:'amr',pose:{x:o.x??1,y:1,yawRad:0.2},quality:'valid',moving:true,hold:null,goal:null,path:[],distanceM:0}],coffee:o.cups?{jobs:[],cups:Array.from({length:o.cups},(_,i)=>({cupId:`cup-${i}`,ownerKind:'cell',ownerId:'coffee-1'}))}:null} as never});
const vs:ViewState={view:'3d',layers:defaultLayers(),selected:null};

test('only poses changed: same key',()=>{
 expect(structureKey(frame({x:1}),vs)).toBe(structureKey(frame({x:2.5,joints:[0.3,-0.2,1,0.1,0.5,0.2]}),vs));
});
test('a layer, the selection, a new object or the arm going from observed to unknown: a new key',()=>{
 const k=structureKey(frame(),vs);
 expect(structureKey(frame(),{...vs,layers:{...vs.layers,frames:true}})).not.toBe(k);
 expect(structureKey(frame(),{...vs,selected:'amr-1'})).not.toBe(k);
 expect(structureKey(frame({cups:1}),vs)).not.toBe(k);
 expect(structureKey(frame({joints:null}),vs)).not.toBe(k);
});
test('posesOf: the AMR base in the ROS map and the arm joints shown, from the frame',()=>{
 const p=posesOf(frame({x:2}));
 expect(p.bodies['amr-1']!.positionM).toEqual([2,1,0]);
 expect(p.bodies['amr-1']!.quaternionXyzw[2]).toBeCloseTo(Math.sin(0.1),12);
 expect(p.arms['arm-1']).toEqual({jointsRad:[0,-0.6,1.2,0,0.6,0],gripperOpeningM:null});
 expect(posesOf(frame({joints:null})).arms).toEqual({});
});
