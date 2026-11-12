// Details inspector of the twin page (level 2): closed by default, four tabs named after what they hold. All four panels stay in the markup
// (hidden when not shown) so in-place repaints keep finding their ids. Only `inspectorOpen` and `tab` survive a reload.
import {tr} from '../i18n';
export type InspectorTab='objects'|'engineering'|'report'|'setup';
export interface TwinUiState {inspectorOpen:boolean;tab:InspectorTab;watch:boolean;displayOpen:boolean;problemsOpen:boolean;runtimeOpen:boolean;pickerOpen:boolean}
const KEY='mekoniq-lab-twin-ui',TABS:InspectorTab[]=['objects','engineering','report','setup'];
export function loadUi():TwinUiState{
 let saved:{inspectorOpen?:unknown;tab?:unknown}|null=null;
 try{saved=JSON.parse(localStorage.getItem(KEY)??'null');}catch{/* empty, broken or blocked storage: defaults */}
 return {inspectorOpen:saved?.inspectorOpen===true,tab:TABS.includes(saved?.tab as InspectorTab)?saved!.tab as InspectorTab:'objects',watch:false,displayOpen:false,problemsOpen:false,runtimeOpen:false,pickerOpen:false};
}
export function saveUi(s:TwinUiState):void{try{localStorage.setItem(KEY,JSON.stringify({inspectorOpen:s.inspectorOpen,tab:s.tab}));}catch{/* a view preference only */}}
const label=(t:InspectorTab)=>({objects:tr('Đối tượng','対象','Objects'),engineering:tr('Kỹ thuật','エンジニアリング','Engineering'),report:tr('Báo cáo','レポート','Report'),setup:tr('Thiết lập','設定','Setup')})[t];
export function inspector(ui:TwinUiState,panels:Record<InspectorTab,string>):string{
 return `<aside class="twin-inspector" id="twin-details" data-testid="twin-inspector" aria-label="${tr('Chi tiết','詳細','Details')}"${ui.inspectorOpen?'':' hidden'}><div class="twin-tabs" role="tablist" aria-label="${tr('Chi tiết','詳細','Details')}">${TABS.map(t=>`<button role="tab" id="inspector-tab-${t}" data-testid="inspector-tab-${t}" data-action="twin-inspector-tab" data-value="${t}" aria-selected="${t===ui.tab}" aria-controls="inspector-panel-${t}">${label(t)}</button>`).join('')}</div>
${TABS.map(t=>`<div class="twin-tabpanel" role="tabpanel" id="inspector-panel-${t}" aria-labelledby="inspector-tab-${t}" tabindex="0"${t===ui.tab?'':' hidden'}>${panels[t]}</div>`).join('')}</aside>`;
}
