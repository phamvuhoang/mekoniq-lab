// Layer toggles and legend. Each overlay states its provenance; status is always text or pattern, never color alone.
import {tr} from '../i18n';
export type Layer='footprint'|'path'|'contacts'|'frames';
export type Layers=Record<Layer,boolean>;
export const LAYERS:Layer[]=['footprint','path','contacts','frames'];
export const defaultLayers=():Layers=>({footprint:true,path:true,contacts:false,frames:false});
export const layerLabel=(l:Layer)=>({footprint:tr('Vùng chiếm chỗ','フットプリント','Footprint'),path:tr('Đường đi','経路','Path'),contacts:tr('Tiếp xúc','接触','Contacts'),frames:tr('Khung tọa độ','座標系','Frames')})[l];
export const toggleLayer=(layers:Layers,l:Layer):Layers=>({...layers,[l]:!layers[l]});
/** Legend: what each mark means. Mock "observed" values come from the backend's observation stream (a model), not from a sensor. */
export const legend=()=>[
 {id:'modeled',mark:'solid',label:tr('Mô hình','モデル','Modeled'),note:tr('hình học / tham số minh họa','参考形状・パラメータ','illustrative geometry / parameters')},
 {id:'observed',mark:'filled',label:tr('Quan sát','観測','Observed'),note:tr('từ luồng quan sát của backend (mock = mô hình)','バックエンド観測(モック=モデル)','from the backend observation stream (mock = model)')},
 {id:'commanded',mark:'dashed-line',label:tr('Lệnh','指令','Commanded'),note:tr('đã phát không có nghĩa đã đến','発行≠到着','issued is not arrived')},
 {id:'derived',mark:'dotted',label:tr('Suy ra','推定','Derived'),note:tr('vị trí cell suy ra từ điểm bàn giao','受渡点から推定した配置','cell placement derived from the handoff point')},
 {id:'unknown',mark:'dashed',label:tr('Chưa rõ','不明','Unknown'),note:tr('không hiển thị thành 0 hay trạng thái tốt','0や正常として表示しない','never shown as zero or healthy')},
];
