// Run bar of the twin page (level 1, always shown): scenario, runtime state, the simulation label, run status, sim time, served, problem
// count, the one primary action and the inspector toggle. Every value is passed in; nothing here decides a run state.
import {icon,esc} from './icons';
import {tr} from '../i18n';
import {backendReasons} from '../scenarios/preflight';
import type {TwinHealth} from '../scenarios/controls';
import type {LinkState} from '../runtime/stream';
import type {Freshness} from '../twin/freshness';
import type {TwinPreset} from '../scenarios/catalog';
import {businessSimulationNote,illustrativeNote} from './labels';
/** `mode` is the simulation label's text (`simLabel`). */
export type RuntimeState='none'|'connecting'|'live'|'slow'|'lost'|'recorded';
/** `runtime.label` is one word (runtimeWord); the telemetry detail lives in the Engineering tab and the runtime box. */
export interface RunBarState {scenarioTitle:string;runtime:{state:RuntimeState;label:string;detail:string};mode:string;
 status:string|null;simTimeS:number|null;served:string|null;problems:number;primary:{action:string;label:string;disabled:boolean}|null;inspectorOpen:boolean}
/** The run bar's runtime word: it describes the link. `link` is `closed` while paired with no run (ready) and `connecting` while the health check is
 * pending. Between steps no sample is due (the browser pumps the clock), so an old sample means a slow link only while auto-run is `playing`. */
export function runtimeWord(link:LinkState,freshness:Freshness['state'],paired:boolean,replay:boolean,playing:boolean):{state:RuntimeState;label:string}{
 const state:RuntimeState=replay?'recorded':!paired?'none':link==='connecting'?'connecting':link==='closed'?'live':['session_lost','run_lost','runtime_lost'].includes(link)?'lost'
  :link==='polling'||link==='reconnecting'?'slow':freshness==='disconnected'?'lost':playing&&freshness==='stale'?'slow':'live';
 const label=state==='live'&&link==='closed'?tr('Sẵn sàng','準備完了','Ready'):{none:tr('Chưa ghép nối','未ペアリング','Not paired'),connecting:tr('Đang kết nối','接続中','Connecting'),live:tr('Trực tiếp','ライブ','Live'),slow:tr('Chậm','遅延','Slow'),lost:tr('Mất kết nối','切断','Disconnected'),recorded:tr('Bản ghi','記録','Recorded')}[state];
 return {state,label};
}
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
${s.problems?`<button class="twin-problems" data-testid="problems-count" data-action="twin-problems-toggle" aria-expanded="${!!o.problemsOpen}" aria-controls="twin-problems">${icon('info',14)}<span>${s.problems} <span class="twin-narrow-hide">${tr('vấn đề','件の問題','problems')}</span></span></button>`:''}
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
/** `telemetry`: the link detail of the open run (repainted in place as #twin-telemetry-box), null without a run. */
export function runtimePopover(s:{open:boolean;pairFormHtml:string;sourceCommit:string|null;telemetry:string|null}):string{
 return `<div class="twin-popover twin-runtime-box" id="twin-runtime-box" data-testid="runtime-popover"${s.open?'':' hidden'}><h3>Runtime</h3>${s.pairFormHtml}${s.telemetry===null?'':`<p class="twin-telemetry" id="twin-telemetry-box">${esc(s.telemetry)}</p>`}${s.sourceCommit?`<p class="field-help">source <code>${esc(s.sourceCommit.slice(0,7))}</code></p>`:''}</div>`;
}
