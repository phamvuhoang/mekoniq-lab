// Twin presets: a server-owned scenario id + backend set, run against a fixture project. Names are entity labels (data), not UI copy.
import nativeFixture from '../../fixtures/twins/native-bv01-v2.json' with {type:'json'};
import coffeeFixture from '../../fixtures/twins/coffee-cell-v2.json' with {type:'json'};
import restaurantFixture from '../../fixtures/twins/restaurant-v2.json' with {type:'json'};
import serveDesign from '../../fixtures/engineering/serve-demo-v1/serve-project.json' with {type:'json'};
import type {AssetRevision,LabProjectV2} from '../shared/types';
import {tr} from '../i18n';
/** Present only on an engineering preset: the exact draft that was compiled and the receipt for it. */
export interface EngineeringPresetInput {project:import('../shared/engineering').EngineeringProject;receipt:import('../shared/engineering').BundleReceipt|null}
export interface TwinPreset {engineering?:EngineeringPresetInput;mode?:'mock'|'simulation';id:string;title:()=>string;summary:()=>string;scenarioId:string;scenarioRevision:number;backendSetId:string;seed:number;
 project:LabProjectV2;assets:AssetRevision[];names:Record<string,string>;roles:{entities:LabProjectV2['entities'][number]['kind'][];points:string[]};}
export const presets:TwinPreset[]=[
 {id:'coffee',title:()=>tr('Cà phê sữa đá','アイスミルクコーヒー','Iced milk coffee'),summary:()=>tr('BV01 · espresso + cà phê sữa đá · máy pha → arm → khay robot → bàn','BV01 · エスプレッソ + アイスミルクコーヒー · マシン → アーム → ロボットトレイ → テーブル','BV01 · espresso + iced milk coffee · machine → arm → robot tray → table'),
  scenarioId:'BV01',scenarioRevision:1,backendSetId:'mock-default',seed:42,project:coffeeFixture.project as LabProjectV2,assets:coffeeFixture.assets as AssetRevision[],
  names:{'coffee-1':'Coffee cell','arm-1':'Arm-1','amr-1':'AMR-1','cups-1':'Cup station'},roles:{entities:['amr','arm','coffee_machine'],points:['coffee_pickup','table','parking']}},
 {id:'delivery',title:()=>tr('Một đơn giao món','1件の配膳','One delivery order'),summary:()=>tr('FD01 · bếp → bàn → điểm chờ, một robot','FD01 · 厨房 → テーブル → 待機、ロボット1台','FD01 · kitchen → table → parking, one robot'),
  scenarioId:'FD01',scenarioRevision:1,backendSetId:'mock-amr',seed:42,project:restaurantFixture.project as LabProjectV2,assets:restaurantFixture.assets as AssetRevision[],
  names:{'amr-1':'AMR-1'},roles:{entities:['amr'],points:['kitchen','table','parking']}},
];
const mixedProject:LabProjectV2=structuredClone(coffeeFixture.project as LabProjectV2);
mixedProject.entities.push({...structuredClone(mixedProject.entities.find(e=>e.kind==='amr')!),id:'amr-2'});
mixedProject.world={...mixedProject.world,width:10,height:6,points:[...mixedProject.world.points.map(p=>p.kind==='table'?{...p,x:8.5,y:1.5}:p),{id:'parking-2',name:'Parking 2',kind:'parking',x:0.8,y:5},{id:'kitchen',name:'Kitchen',kind:'kitchen',x:1,y:3},{id:'table-2',name:'T02',kind:'table',x:8.5,y:4.5}],obstacles:[{id:'wall-south',x:4.5,y:0,width:1,height:2.5},{id:'wall-north',x:4.5,y:3.5,width:1,height:2.5}]};
for(const [id,scenarioId,seed,title,summary] of [
 ['mixed','FD02-cups',42,()=>tr('Món ăn và cà phê cùng chuyến','料理とコーヒーを同じ便で','Food and coffee together'),()=>tr('Một mission giao món ăn và cốc cà phê đã xác định.','1つのミッションで料理と識別済みカップを配送。','One mission carries food and its identified coffee cup.')],
 ['campaign','CAMPAIGN-FD02-FD07-BV01-BV03',3,()=>tr('Chiến dịch hai robot','2台ロボットの連続シナリオ','Two-robot campaign'),()=>tr('Hai AMR dùng chung hành lang, món ăn và hai recipe cà phê.','2台のAMRが通路を共有し、料理と2種のコーヒーを配送。','Two AMRs share a corridor while delivering food and two coffee recipes.')],
] as const)presets.push({...presets[0]!,id,scenarioId,seed,title,summary,project:structuredClone(mixedProject),names:{...presets[0]!.names,'amr-2':'AMR-2'},roles:{entities:['amr','arm','coffee_machine'],points:['kitchen','coffee_pickup','table','parking']}});
presets.push({...presets[0]!,id:'native-bv01',mode:'simulation',backendSetId:'coffee-simulation',seed:23,project:nativeFixture.project as LabProjectV2,assets:nativeFixture.assets as AssetRevision[],title:()=>tr('BV01 native SIM','BV01 ネイティブSIM','BV01 native SIM'),summary:()=>tr('Gazebo + LinuxCNC · hình học PUMA560 SIM đã ghim · chưa xác minh phần cứng','Gazebo + LinuxCNC · 固定PUMA560 SIM形状 · 実機未検証','Gazebo + LinuxCNC · pinned PUMA560 SIM geometry · no hardware validation')});
/** IR-SIM 2D FD01 on the Serve robot: runs only from a receipt the Assembly page compiled for exactly the open Serve design (never from this fixture copy). */
export const IRSIM_SET='engineering-irsim-2d-v1',IRSIM_PROFILE='engineering-irsim-2d-v1';
presets.push({id:'irsim-fd01',mode:'simulation',scenarioId:'IR-FD01',scenarioRevision:1,backendSetId:IRSIM_SET,seed:5,project:structuredClone(serveDesign.runtimeProject) as LabProjectV2,assets:[],names:{'amr-1':'Serve-1'},roles:{entities:['amr'],points:['kitchen','table','parking']},
 engineering:{project:structuredClone(serveDesign) as unknown as import('../shared/engineering').EngineeringProject,receipt:null},
 title:()=>tr('IR-SIM 2D · giao món FD01','IR-SIM 2D · FD01配膳','IR-SIM 2D · FD01 delivery'),summary:()=>tr('Robot Serve · nhà hàng 10 bàn · mô phỏng 2D di động, không phải Gazebo hay phần cứng','Serveロボット · 10卓レストラン · ポータブル2D、Gazebo・実機ではない','Serve robot · 10-table restaurant · portable 2D, not Gazebo or hardware')});
export const presetById=(id:string)=>presets.find(p=>p.id===id);
/** Display name of an entity, point, cup or job; unknown ids are shown as-is, never invented. */
export function nameOf(preset:TwinPreset|undefined,id:string):string {
 const name=preset?.names[id]??preset?.project.world.points.find(p=>p.id===id)?.name??id;
 const common:Record<string,string>={'Coffee cell':tr('Trạm cà phê','コーヒーセル','Coffee cell'),'Cup station':tr('Trạm cốc','カップ置場','Cup station'),'Arm-1':tr('Cánh tay 1','アーム1','Arm-1'),'Parking':tr('Điểm chờ','待機場所','Parking'),'Kitchen':tr('Bếp','厨房','Kitchen'),'Dock':tr('Trạm sạc','充電場所','Dock')};
 return common[name]??name;
}
