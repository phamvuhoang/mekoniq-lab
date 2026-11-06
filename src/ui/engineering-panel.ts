// Engineering view of the selected entity: every value with unit, source and age; observed and commanded side by side. Plus test faults.
import type {Inspection} from '../twin/inspector';
import type {Source} from '../twin/amr';
import {icon,esc} from './icons';
import {tr} from '../i18n';
const sourceText=(s:Source|string)=>({observed:tr('quan sát','観測','observed'),commanded:tr('lệnh','指令','commanded'),modeled:tr('mô hình','モデル','modeled'),derived:tr('suy ra','推定','derived'),unknown:tr('chưa rõ','不明','unknown')})[s]??s;
const age=(ms:number|null)=>ms===null?`<span class="unknown-text">${tr('chưa rõ','不明','unknown')}</span>`:`${Math.max(0,Math.round(ms))} ms`;
/** Faults the mock backends accept; ids are runtime contract values, labels are localized. */
export const FAULTS:[string,()=>string][]=[
 ['cup-removed',()=>tr('Rút cốc khỏi vòi','ノズルからカップを外す','Remove cup from nozzle')],['ice-jam',()=>tr('Kẹt đá','氷詰まり','Ice jam')],['milk-empty',()=>tr('Hết sữa','牛乳切れ','Milk empty')],
 ['measure-missing',()=>tr('Mất số đo','計量欠落','Measurement missing')],['coffee-reboot',()=>tr('Khởi động lại máy pha','マシン再起動','Coffee machine reboot')],['arm-reboot',()=>tr('Khởi động lại arm','アーム再起動','Arm reboot')],
 ['collide',()=>tr('Va chạm AMR (mô phỏng)','AMR衝突(模擬)','AMR collision (simulated)')],['reboot',()=>tr('Khởi động lại AMR','AMR再起動','AMR reboot')],
];
export function engineeringInspection(insp:Inspection|null):string {
 const rows=insp?.rows??[];
 const table=insp?`<div class="inspector-head"><span class="eyebrow">${esc(insp.kind)} · ${sourceText(insp.source)}</span><h3 data-testid="inspector-title">${esc(insp.title)}${insp.title!==insp.id?` <small>${esc(insp.id)}</small>`:''}</h3></div>
${rows.length?`<div class="eng-table-wrap" tabindex="0" role="region" aria-label="${tr('Giá trị kỹ thuật','技術値','Engineering values')}"><table class="eng-table"><caption class="visually-hidden">${tr('Giá trị kỹ thuật của','技術値:','Engineering values for')} ${esc(insp.title)}</caption><thead><tr><th scope="col">${tr('Đại lượng','項目','Quantity')}</th><th scope="col">${tr('Quan sát','観測','Observed')}</th><th scope="col">${tr('Lệnh','指令','Commanded')}</th><th scope="col">${tr('Đơn vị','単位','Unit')}</th><th scope="col">${tr('Nguồn','出典','Source')}</th><th scope="col">${tr('Tuổi dữ liệu','データ経過','Data age')}</th></tr></thead><tbody>${rows.map(r=>`<tr data-testid="eng-${esc(r.key)}"><th scope="row">${esc(r.label)}</th><td>${esc(r.observed)}</td><td>${esc(r.commanded)}</td><td>${esc(r.unit)||'—'}</td><td><span class="source-tag ${r.source}">${sourceText(r.source)}</span></td><td>${age(r.ageMs)}</td></tr>`).join('')}</tbody></table></div>`:''}<p class="field-help">${esc(insp.note)}</p>`
  :`<p class="empty-inline">${tr('Chọn một đối tượng trong cảnh hoặc danh sách để xem chi tiết.','シーンまたは一覧から対象を選択。','Select an object in the scene or list to inspect it.')}</p>`;
 return table;
}
export function engineeringPanel(insp:Inspection|null,o:{hasRun:boolean;busy:boolean;fault:string;coffee:boolean}):string {
 const faults=o.hasRun?`<div class="fault-actions"><label for="twin-fault">${tr('Chèn lỗi thử nghiệm (mock)','テスト障害を注入(モック)','Inject test fault (mock)')}</label><select id="twin-fault">${FAULTS.filter(([id])=>o.coffee||['collide','reboot'].includes(id)).map(([id,l])=>`<option value="${id}" ${o.fault===id?'selected':''}>${l()} · ${id}</option>`).join('')}</select><button class="button quiet" data-action="twin-fault" ${o.busy?'disabled':''}>${icon('bolt',16)}${tr('Chèn lỗi','注入','Inject')}</button></div>`:'';
 return `<section class="panel eng-panel" data-testid="engineering-panel" aria-labelledby="eng-title"><div class="panel-heading"><h2 id="eng-title">${tr('Kỹ thuật','エンジニアリング','Engineering')}</h2><span class="pill">${tr('Kỹ sư','エンジニア','Engineer')}</span></div><div id="twin-inspector">${engineeringInspection(insp)}</div>${faults}</section>`;
}
