// Twin presets: a server-owned scenario id + backend set, run against a fixture project. Names are entity labels (data), not UI copy.
import coffeeFixture from '../../fixtures/twins/coffee-cell-v2.json';
import restaurantFixture from '../../fixtures/twins/restaurant-v2.json';
import type {AssetRevision,LabProjectV2} from '../shared/types';
import {tr} from '../i18n';
export interface TwinPreset {id:string;title:()=>string;summary:()=>string;scenarioId:string;scenarioRevision:number;backendSetId:string;seed:number;
 project:LabProjectV2;assets:AssetRevision[];names:Record<string,string>;roles:{entities:LabProjectV2['entities'][number]['kind'][];points:string[]};recipes:string[];}
export const presets:TwinPreset[]=[
 {id:'coffee',title:()=>tr('Cà phê sữa đá','アイスミルクコーヒー','Iced milk coffee'),summary:()=>tr('BV01 · espresso + cà phê sữa đá · máy pha → arm → khay robot → bàn','BV01 · エスプレッソ + アイスミルクコーヒー · マシン → アーム → ロボットトレイ → テーブル','BV01 · espresso + iced milk coffee · machine → arm → robot tray → table'),
  scenarioId:'BV01',scenarioRevision:1,backendSetId:'mock-default',seed:42,project:coffeeFixture.project as LabProjectV2,assets:coffeeFixture.assets as AssetRevision[],
  names:{'coffee-1':'Coffee cell','arm-1':'Arm-1','amr-1':'AMR-1','cups-1':'Cup station'},roles:{entities:['amr','arm','coffee_machine'],points:['coffee_pickup','table','parking']},recipes:['espresso r1','iced-milk-coffee r1']},
 {id:'delivery',title:()=>tr('Một đơn giao món','1件の配膳','One delivery order'),summary:()=>tr('FD01 · bếp → bàn → điểm chờ, một robot','FD01 · 厨房 → テーブル → 待機、ロボット1台','FD01 · kitchen → table → parking, one robot'),
  scenarioId:'FD01',scenarioRevision:1,backendSetId:'mock-amr',seed:42,project:restaurantFixture.project as LabProjectV2,assets:restaurantFixture.assets as AssetRevision[],
  names:{'amr-1':'AMR-1'},roles:{entities:['amr'],points:['kitchen','table','parking']},recipes:[]},
];
export const presetById=(id:string)=>presets.find(p=>p.id===id);
/** Display name of an entity, point, cup or job; unknown ids are shown as-is, never invented. */
export function nameOf(preset:TwinPreset|undefined,id:string):string {
 return preset?.names[id]??preset?.project.world.points.find(p=>p.id===id)?.name??id;
}
