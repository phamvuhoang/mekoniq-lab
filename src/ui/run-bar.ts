// Run bar of the twin page (level 1, always shown): scenario, runtime state, the simulation label, run status, sim time, served, problem
// count, the one primary action and the inspector toggle. Every value is passed in; nothing here decides a run state.
import {icon,esc} from './icons';
import {tr} from '../i18n';
import {backendReasons} from '../scenarios/preflight';
import type {TwinHealth} from '../scenarios/controls';
import type {LinkState} from '../runtime/stream';
import type {Freshness} from '../twin/freshness';
import type {TwinPreset} from '../scenarios/catalog';
import {targetAddress,type RuntimeTarget} from '../runtime/target';
import {businessSimulationNote,illustrativeNote} from './labels';
/** `mode` is the simulation label's text (`simLabel`). */
export type RuntimeState='none'|'connecting'|'live'|'slow'|'lost'|'recorded';
/** `runtime.label` is one word (runtimeWord); the telemetry detail lives in the Engineering tab and the runtime box. */
export interface RunBarState {scenarioTitle:string;runtime:{state:RuntimeState;label:string;detail:string};mode:string;
 status:string|null;simTimeS:number|null;served:string|null;/** blockers and attention items */problems:number;/** notes, listed in the same panel and never counted as problems */notes?:number;primary:{action:string;label:string;disabled:boolean}|null;inspectorOpen:boolean}
/** The run bar's runtime word: it describes the link. `link` is `closed` while paired with no run (ready) and `connecting` while the health check is
 * pending. Between steps no sample is due (the browser pumps the clock), so an old sample means a slow link only while auto-run is `playing`. */
export function runtimeWord(link:LinkState,freshness:Freshness['state'],paired:boolean,replay:boolean,playing:boolean):{state:RuntimeState;label:string}{
 const state:RuntimeState=replay?'recorded':!paired?'none':link==='connecting'?'connecting':link==='closed'?'live':['session_lost','run_lost','runtime_lost'].includes(link)?'lost'
  :link==='polling'||link==='reconnecting'?'slow':freshness==='disconnected'?'lost':playing&&freshness==='stale'?'slow':'live';
 const label=state==='live'&&link==='closed'?tr('Sẵn sàng','準備完了','Ready'):{none:tr('Chưa ghép nối','未ペアリング','Not paired'),connecting:tr('Đang kết nối','接続中','Connecting'),live:tr('Trực tiếp','ライブ','Live'),slow:tr('Chậm','遅延','Slow'),lost:tr('Mất kết nối','切断','Disconnected'),recorded:tr('Bản ghi','記録','Recorded')}[state];
 return {state,label};
}
const notesLabel=(n:number)=>tr(`${n} lưu ý`,`${n} 件の注意`,`${n} ${n===1?'note':'notes'}`);
const item=(label:string,value:string,id:string)=>`<span class="twin-bar-item" data-testid="${id}"><small>${label}</small><b>${esc(value)}</b></span>`;
/** The always-visible label: never drops "simulation", and says "not calibrated" for a simulation run unless its report says calibrated. */
export function simLabel(mode:string|null,calibrated:boolean):string{
 const sim=tr('Mô phỏng','シミュレーション','Simulation');
 if(!mode)return `${sim} · ${tr('chưa chạy','未実行','not run')}`;
 return `${sim} · ${mode.toUpperCase()}${mode==='simulation'&&!calibrated?` · ${tr('chưa hiệu chuẩn','未校正','not calibrated')}`:''}`;
}
/** `o` carries the open state of the run bar's boxes and their markup (picker, runtime, problems, caveat), drawn under the bar over the viewport. */
export function runBar(s:RunBarState,o:{pickerOpen?:boolean;runtimeOpen?:boolean;problemsOpen?:boolean;caveatOpen?:boolean;boxesHtml?:string}={}):string{
 return `<div class="twin-runbar" id="twin-run-bar" role="region" aria-label="${tr('Lần chạy','実行','Run')}">
<div class="twin-runbar-left"><button class="twin-scenario" data-testid="scenario-picker" data-action="twin-picker-toggle" aria-expanded="${!!o.pickerOpen}" aria-controls="twin-picker" aria-labelledby="twin-scenario-label" aria-describedby="twin-scenario-value"><span><small id="twin-scenario-label">${tr('Kịch bản','シナリオ','Scenario')}</small><b id="twin-scenario-value">${esc(s.scenarioTitle)}</b></span>${icon('chevron',14)}</button>
<button class="twin-runtime-chip" id="twin-runtime-chip" data-testid="runtime-chip" data-action="twin-runtime-toggle" data-state="${s.runtime.state}" aria-expanded="${!!o.runtimeOpen}" aria-controls="twin-runtime-box"${s.runtime.detail?` title="${esc(s.runtime.detail)}"`:''}><i aria-hidden="true"></i><span class="visually-hidden">Runtime: </span><span id="twin-runtime-word">${esc(s.runtime.label)}</span></button>
<button class="twin-mode${s.status?' live':''}" data-testid="mode-badge" data-action="twin-caveat-toggle" aria-expanded="${!!o.caveatOpen}" aria-controls="twin-caveat">${icon(s.status?'lock':'info',14)}<span>${esc(s.mode)}</span></button></div>
<div class="twin-runbar-right">${item(tr('Trạng thái','状態','Status'),s.status??'—','run-status')}${s.runtime.state==='recorded'?`<span class="twin-recorded" data-testid="recorded-tag">${icon('lock',12)}${tr('Bản ghi','記録','Recorded')}</span>`:''}${item(tr('Thời gian mô phỏng','シミュレーション時間','Sim time'),s.simTimeS===null?'—':`${s.simTimeS.toFixed(1)} s`,'run-tick')}${item(tr('Đã giao','提供数','Served'),s.served??'—','run-served')}
${s.problems||s.notes?`<button class="twin-problems${s.problems?'':' notes-only'}"${s.problems?' data-testid="problems-count"':''} data-action="twin-problems-toggle" aria-expanded="${!!o.problemsOpen}" aria-controls="twin-problems">${icon('info',14)}${s.problems?`<span>${s.problems} <span class="twin-narrow-hide">${tr('vấn đề','件の問題','problems')}</span></span>${s.notes?`<span class="visually-hidden" data-testid="notes-count">, ${notesLabel(s.notes)}</span>`:''}`:`<span data-testid="notes-count">${notesLabel(s.notes!)}</span>`}</button>`:''}
${s.primary?`<button class="button primary" data-testid="primary-action" data-action="${esc(s.primary.action)}"${s.primary.disabled?' disabled':''}>${esc(s.primary.label)}</button>`:''}
<button class="button quiet twin-details-toggle" data-action="twin-inspector-toggle" aria-expanded="${s.inspectorOpen}" aria-controls="twin-details">${icon('result',16)}<span class="twin-narrow-hide">${tr('Chi tiết','詳細','Details')}</span></button></div>
${o.boxesHtml??''}</div>`;
}
export interface PickerItem {id:string;title:string;summary:string;runnable:boolean;reasons:string[]}
/** Runnable presets first, the rest after them; catalog order within each. Without a health answer nothing is known, so every preset is runnable (preflight still decides). */
export function pickerItems(all:readonly TwinPreset[],health:TwinHealth|null):PickerItem[]{
 const items=all.map(p=>{const reasons=health?backendReasons(p,health):[];return {id:p.id,title:p.title(),summary:p.summary(),runnable:!reasons.length,reasons};});
 return [...items.filter(i=>i.runnable),...items.filter(i=>!i.runnable)];
}
export function scenarioPicker(items:readonly PickerItem[],currentId:string,open:boolean):string{
 return `<div class="twin-popover twin-picker" id="twin-picker" role="group" aria-label="${tr('Kịch bản','シナリオ','Scenarios')}"${open?'':' hidden'}><ul class="picker-list">${items.map(x=>`<li><button class="preset-option" data-action="twin-preset" data-value="${esc(x.id)}" aria-pressed="${x.id===currentId}" aria-label="${esc(x.title)}" aria-describedby="preset-${esc(x.id)}-summary"${x.runnable?'':' disabled'}>${icon(x.id==='coffee'?'coffee':'robot',20)}<span><b>${esc(x.title)}</b><small id="preset-${esc(x.id)}-summary">${esc(x.summary)}${x.reasons.length?`<span class="picker-reasons" data-testid="picker-reasons">${tr('Runtime này không chạy được','このランタイムでは実行不可','Not runnable on this runtime')}: ${x.reasons.map(r=>`<code>${esc(r)}</code>`).join(' ')}</span>`:''}</small></span></button></li>`).join('')}</ul></div>`;
}
/** What the label stands for: the mode with its access word, the shared honesty notes and the report's limitations. */
export function caveatPopover(mode:string,limitations:readonly string[],open:boolean):string{
 return `<div class="twin-popover twin-caveat" id="twin-caveat" data-testid="caveat-detail"${open?'':' hidden'}><h3>${tr('Đây là mô phỏng','これはシミュレーションです','This is a simulation')}</h3><p><small>${tr('Chế độ','モード','Mode')}</small> <b class="small-code">${esc(mode)}</b></p><p class="source-note">${icon('info',15)}${esc(illustrativeNote())} · ${esc(businessSimulationNote())}</p>${limitations.length?`<h3>${tr('Giới hạn theo báo cáo','レポート記載の制約','Limitations from the report')}</h3><ul class="caveat-limitations" data-testid="caveat-limitations">${limitations.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>`:''}</div>`;
}
/** The launcher's runtime on this machine, as typed from a page elsewhere. */
export const THIS_MACHINE='http://127.0.0.1:4176';
const short=(c:string)=>esc(c.slice(0,7));
/** What a connection error means for the user (codes stay visible for diagnosis); an unknown code is shown as it is. */
function errorText(code:string,origin:string):string{
 const t:Record<string,()=>string>={
  LOOPBACK_BLOCKED:()=>tr(`Trình duyệt chặn kết nối tới 127.0.0.1 từ trang này. Dùng Chrome, Edge hoặc Firefox và cho phép khi được hỏi, hoặc chạy <code>pnpm lab:mujoco</code> rồi mở http://127.0.0.1:4175. Kiểm tra thêm: runtime đang chạy; runtime cho phép origin của trang này (<code>--allow-origin ${esc(origin)}</code>); trình duyệt cho phép truy cập mạng cục bộ; Safari không cho trang HTTPS gọi http://127.0.0.1.`,`このページから127.0.0.1への接続をブラウザがブロックしました。Chrome、EdgeまたはFirefoxを使い、確認されたら許可してください。または<code>pnpm lab:mujoco</code>を実行してhttp://127.0.0.1:4175を開いてください。あわせて確認:ランタイムが起動している、ランタイムがこのページのオリジンを許可している(<code>--allow-origin ${esc(origin)}</code>)、ブラウザがローカルネットワークへのアクセスを許可している、SafariはHTTPSページからhttp://127.0.0.1を呼べない。`,`The browser blocked the connection to 127.0.0.1 from this page. Use Chrome, Edge or Firefox and allow it when asked, or run <code>pnpm lab:mujoco</code> and open http://127.0.0.1:4175. Also check that the runtime is running, that it allows this page's origin (<code>--allow-origin ${esc(origin)}</code>), that the browser allows local network access, and note that Safari does not let an HTTPS page reach http://127.0.0.1.`),
  PAIRING_RATE_LIMITED:()=>tr('Đã thử mã quá nhiều lần: chờ một phút rồi thử lại.','コードの試行が多すぎます。1分待ってから再試行してください。','Too many code attempts: wait a minute, then try again.'),
  PAIRING_INVALID:()=>tr('Mã sai, đã dùng hoặc đã hết hạn: lấy mã mới trong terminal của runtime.','コードが違う、使用済み、または期限切れです。ランタイムの端末で新しいコードを取得してください。','The code is wrong, used or expired: take a new one from the runtime\'s terminal.'),
  SESSION_LIMIT:()=>tr('Runtime không nhận thêm phiên ghép nối: khởi động lại runtime để có mã mới.','ランタイムはこれ以上のセッションを受け付けません。再起動して新しいコードを取得してください。','The runtime accepts no more sessions: restart it for a new code.'),
  RUNTIME_UNREACHABLE:()=>tr('Không thấy runtime /lab/v2. Chạy runtime trên máy phát triển; Lab không tự báo hoàn thành khi thiếu runner.','/lab/v2が見つかりません。開発機でランタイムを起動してください。','No /lab/v2 runtime found. Start the runtime on your development machine; the Lab never reports completion without a runner.'),
  // a page with no runtime of its own (served from the web): the way on is the address field, never "start a runtime here"
  NO_RUNTIME_ON_THIS_PAGE:()=>tr(`Trang này không có runtime riêng. Nhập địa chỉ runtime vào ô Địa chỉ runtime ở trên, ví dụ ${THIS_MACHINE} cho runtime trên máy này, rồi bấm lại.`,`このページには専用のランタイムがありません。上のランタイムのアドレス欄にアドレスを入力し(このマシンなら ${THIS_MACHINE})、その後もう一度お試しください。`,`This page has no runtime of its own. Enter the runtime's address in the runtime address field above, for example ${THIS_MACHINE} for a runtime on this machine, then try again.`),
  NO_PAIRING_CODE:()=>tr('Nhập mã ghép nối một lần in trong terminal của runtime.','ランタイムの端末に表示されたワンタイムコードを入力してください。','Enter the one-time pairing code printed by the runtime\'s terminal.'),
 };
 return `${esc(code)}${t[code]?`: ${t[code]!()}`:''}`;
}
/** The runtime box (D52, SX-47): where the runtime is (this machine or another address), its address, the one-use code, Connect, and the commit the
 * Lab is pinned to beside the commit the runtime reports; a different commit blocks runs. `telemetry`: the open run's link detail (#twin-telemetry-box).
 * `where`: the radio the page keeps (absent: read from the address); `pageOrigin`: named in the LOOPBACK_BLOCKED checklist (--allow-origin). */
export function runtimePopover(s:{open:boolean;target:RuntimeTarget;draftUrl:string;paired:boolean;busy:boolean;health:TwinHealth|null;pin:{expected:string;actual:string|null};error:string|null;where?:'here'|'other';pageOrigin?:string;/** false on a page with no runtime of its own (served from the web): no "empty" hint */pageHasRuntime?:boolean},telemetry:string|null=null):string{
 const d=s.draftUrl.trim().replace(/\/(lab\/v2\/?)?$/,''),here=s.where?s.where==='here':!d||d===THIS_MACHINE,urlError=s.error==='INVALID_RUNTIME_URL',address=targetAddress(s.target);
 const help=s.error&&!urlError&&!(s.error==='RUNTIME_PIN_MISMATCH'&&s.pin.actual)?`<p class="field-error" id="twin-runtime-help" data-testid="runtime-error" role="alert">${errorText(s.error,s.pageOrigin??'')}</p>`
  :!s.health&&s.target.kind!=='same_origin'&&!urlError?`<p class="field-help" id="twin-runtime-help">${tr('Lab chỉ kết nối tới địa chỉ này khi bạn bấm.','このアドレスへはクリックしたときだけ接続します。','The Lab contacts this address only when you click.')}</p>`:'';
 // the sentence under the field describes it (never a second label for it)
 const describedBy=urlError?' aria-invalid="true" aria-describedby="twin-runtime-url-error"':help?' aria-describedby="twin-runtime-help"':'';
 const other=s.target.kind!=='same_origin',connect=`<button class="button secondary" type="button" data-action="twin-connect"${s.busy?' disabled':''}>${icon('link',16)}${tr('Kết nối','接続','Connect')}</button>`;
 const disconnect=`<button class="button quiet" type="button" data-action="twin-disconnect"${s.busy?' disabled':''}>${icon('cross',16)}${tr('Ngắt kết nối','切断','Disconnect')}</button>`;
 const body=s.paired
  // paired: no code needed (a bearer survives a reload); reaching another origin is still a click (Connect)
  ?`<div class="twin-pair"><p class="field-help">${other?`Runtime <code data-testid="runtime-address">${esc(address)}</code>`:tr('Máy này · runtime của trang này','このマシン · このページのランタイム','This machine · this page\'s runtime')}</p><div class="pair-row">${other&&!s.health?connect:''}${disconnect}</div></div>`
  :`<form id="twin-pair-form" class="twin-pair"><fieldset class="twin-where"><legend>${tr('Runtime chạy ở','ランタイムの場所','Where the runtime runs')}</legend>
<label><input type="radio" name="twin-runtime-where" id="twin-runtime-here" value="here"${here?' checked':''}>${tr('Máy này','このマシン','This machine')}</label><label><input type="radio" name="twin-runtime-where" id="twin-runtime-other" value="other"${here?'':' checked'}>${tr('Địa chỉ khác','別のアドレス','Another address')}</label></fieldset>
<label for="twin-runtime-url">${s.pageHasRuntime===false?tr(`Địa chỉ runtime (ví dụ ${THIS_MACHINE} hoặc https://…)`,`ランタイムのアドレス(例:${THIS_MACHINE} または https://…)`,`Runtime address (for example ${THIS_MACHINE} or https://…)`):tr('Địa chỉ runtime (để trống: runtime của trang này)','ランタイムのアドレス(空欄:このページのランタイム)','Runtime address (empty: this page\'s runtime)')}</label><input id="twin-runtime-url" type="text" inputmode="url" autocomplete="off" spellcheck="false" placeholder="${THIS_MACHINE}" value="${esc(s.draftUrl)}"${describedBy}>${urlError?`<p class="field-error" id="twin-runtime-url-error" data-testid="runtime-address-error" role="alert">${tr('Địa chỉ không hợp lệ: dùng https://… hoặc http://127.0.0.1:<cổng>, http://localhost:<cổng>, http://[::1]:<cổng>, chỉ origin.','無効なアドレス:https://… または http://127.0.0.1:<ポート>、http://localhost:<ポート>、http://[::1]:<ポート>(オリジンのみ)を使ってください。','Invalid address: use https://… or http://127.0.0.1:<port>, http://localhost:<port>, http://[::1]:<port>, origin only.')}</p>`:''}
<label for="twin-pair-token">${tr('Mã ghép nối một lần từ terminal runtime','ランタイム端末のワンタイムペアリングコード','One-time pairing code from the runtime terminal')}</label><div class="pair-row"><input id="twin-pair-token" type="password" autocomplete="off" required><button class="button secondary" type="submit" data-action="twin-connect"${s.busy?' disabled':''}>${icon('link',16)}${tr('Ghép nối runtime','ランタイムをペアリング','Pair runtime')}</button></div></form>`;
 const mismatch=!!s.pin.actual&&!!s.pin.expected&&s.pin.actual!==s.pin.expected;
 const commits=`<dl class="twin-commits"><div><dt>${tr('Lab ghim','Labの固定','Lab pinned to')}</dt><dd><code data-testid="runtime-pin-commit">${s.pin.expected?short(s.pin.expected):'—'}</code></dd></div><div><dt>${tr('Runtime chạy','ランタイムの版','Runtime runs')}</dt><dd><code data-testid="runtime-commit">${s.pin.actual?short(s.pin.actual):'—'}</code></dd></div></dl>${mismatch?`<p class="field-error" data-testid="runtime-pin-mismatch" role="alert">RUNTIME_PIN_MISMATCH: ${tr(`runtime chạy source ${short(s.pin.actual!)}, Lab ghim ${short(s.pin.expected)}: không tạo lần chạy. Dùng runtime đúng bản ghim.`,`ランタイムのソースは ${short(s.pin.actual!)}、Labの固定は ${short(s.pin.expected)}。実行は作成しません。固定版のランタイムを使ってください。`,`the runtime runs source ${short(s.pin.actual!)}; the Lab is pinned to ${short(s.pin.expected)}. No run is created: use the pinned runtime.`)}</p>`:''}`;
 return `<div class="twin-popover twin-runtime-box" id="twin-runtime-box" data-testid="runtime-popover"${s.open?'':' hidden'}><h3>Runtime</h3>${body}${help}${commits}${telemetry===null?'':`<p class="twin-telemetry" id="twin-telemetry-box">${esc(telemetry)}</p>`}</div>`;
}
