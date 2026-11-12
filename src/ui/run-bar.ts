// Run bar of the twin page (level 1, always shown): scenario, runtime state, the simulated label, run status, sim time, served, problem
// count, the one primary action and the inspector toggle. Every value is passed in; nothing here decides a run state.
import {icon,esc} from './icons';
import {tr} from '../i18n';
export interface RunBarState {scenarioTitle:string;runtime:{state:'none'|'connecting'|'live'|'slow'|'lost';label:string;detail:string};mode:string;
 status:string|null;simTimeS:number|null;served:string|null;problems:number;primary:{action:string;label:string;disabled:boolean}|null;inspectorOpen:boolean}
const item=(label:string,value:string,id:string)=>`<span class="twin-bar-item" data-testid="${id}"><small>${label}</small><b>${esc(value)}</b></span>`;
/** `o` carries the boxes the scenario button (U01: the preset list) and the runtime chip (`runtimePopover`) open under the bar. */
export function runBar(s:RunBarState,o:{pickerOpen?:boolean;pickerHtml?:string;runtimeOpen?:boolean;runtimeHtml?:string}={}):string{
 return `<div class="twin-runbar" id="twin-run-bar" role="region" aria-label="${tr('Lần chạy','実行','Run')}">
<div class="twin-runbar-left"><button class="twin-scenario" data-testid="scenario-picker" data-action="twin-picker-toggle" aria-expanded="${!!o.pickerOpen}" aria-controls="twin-picker" aria-labelledby="twin-scenario-label" aria-describedby="twin-scenario-value"><span><small id="twin-scenario-label">${tr('Kịch bản','シナリオ','Scenario')}</small><b id="twin-scenario-value">${esc(s.scenarioTitle)}</b></span>${icon('chevron',14)}</button>
<button class="twin-runtime-chip" data-testid="runtime-chip" data-action="twin-runtime-toggle" data-state="${s.runtime.state}" aria-expanded="${!!o.runtimeOpen}" aria-controls="twin-runtime-box"${s.runtime.detail?` title="${esc(s.runtime.detail)}"`:''}><i aria-hidden="true"></i><span class="visually-hidden">Runtime: </span><span id="twin-telemetry" data-testid="twin-telemetry" aria-live="off">${esc(s.runtime.label)}</span></button>
<span class="twin-mode${s.status?' live':''}" data-testid="mode-badge">${icon(s.status?'lock':'info',14)}<span>${esc(s.mode)}</span></span></div>
<div class="twin-runbar-right">${item(tr('Trạng thái','状態','Status'),s.status??'—','run-status')}${item(tr('Thời gian mô phỏng','シミュレーション時間','Sim time'),s.simTimeS===null?'—':`${s.simTimeS.toFixed(1)} s`,'run-tick')}${item(tr('Đã giao','提供数','Served'),s.served??'—','run-served')}
${s.problems?`<span class="twin-problems" data-testid="problems-count">${icon('info',14)}${s.problems} ${tr('vấn đề','件の問題','problems')}</span>`:''}
${s.primary?`<button class="button primary" data-testid="primary-action" data-action="${esc(s.primary.action)}"${s.primary.disabled?' disabled':''}>${esc(s.primary.label)}</button>`:''}
<button class="button quiet twin-details-toggle" data-action="twin-inspector-toggle" aria-expanded="${s.inspectorOpen}" aria-controls="twin-details">${icon('result',16)}${tr('Chi tiết','詳細','Details')}</button></div>
<div class="twin-popover twin-picker" id="twin-picker" role="group" aria-label="${tr('Kịch bản','シナリオ','Scenarios')}"${o.pickerOpen?'':' hidden'}>${o.pickerHtml??''}</div>${o.runtimeHtml??''}</div>`;
}
export function runtimePopover(s:{open:boolean;pairFormHtml:string;sourceCommit:string|null}):string{
 return `<div class="twin-popover twin-runtime-box" id="twin-runtime-box" data-testid="runtime-popover"${s.open?'':' hidden'}><h3>Runtime</h3>${s.pairFormHtml}${s.sourceCommit?`<p class="field-help">source <code>${esc(s.sourceCommit.slice(0,7))}</code></p>`:''}</div>`;
}
