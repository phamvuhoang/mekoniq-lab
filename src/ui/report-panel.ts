// Replay, trace, compare and export of the run report. Read-only: built on reports/replay (no runtime client), every runtime string escaped.
import type {RunReport} from '../scenarios/controls';
import type {openReplayV2} from '../reports/replay';
import {compareRuns} from '../reports/compare';
import {summarizeReportV2} from '../reports/metrics';
import {icon,esc} from './icons';
import {tr} from '../i18n';
export interface ReplayState {rp:ReturnType<typeof openReplayV2>;tick:number;playing:boolean}
const fmt=(n:number|null,d=2)=>n===null||!Number.isFinite(n)?'—':Number.isInteger(n)?String(n):n.toFixed(d);
const sampleText=(s:{entityId:string;quality:string;observed:Record<string,unknown>|null;commanded:Record<string,unknown>|null;reasonCodes:string[]})=>{
 const o=s.observed,c=s.commanded;
 if(o&&typeof o.xM==='number')return `x ${fmt(o.xM as number)} m · y ${fmt(o.yM as number)} m · ${fmt(o.yawRad as number,3)} rad`;
 if(c&&Array.isArray(c.jointsRad))return `${tr('lệnh','指令','commanded')} q = [${(c.jointsRad as number[]).map(q=>fmt(q,3)).join(', ')}] rad · ${tr('quan sát','観測','observed')}: ${s.reasonCodes[0]??'—'}`;
 if(o&&'cycleState' in o)return `${o.cycleState} · ${tr('cốc','カップ','cup')} ${o.cupPresent===null?'?':o.cupPresent?tr('có','あり','present'):tr('không','なし','absent')} · ${o.machineStatus??'?'}`;
 return s.quality;
};
/** Body of the replay section: re-rendered on scrub without replacing the range input. */
export function replayBody(r:ReplayState,selected:string|null):string{
 const f=r.rp.seek(r.tick),last=f.events.slice(-6).reverse(),trace=selected?r.rp.trace(selected).filter(row=>row.tick<=f.tick):[];
 return `<p class="replay-time" data-testid="replay-time">${tr('Thời điểm ghi','記録時刻','Recorded time')} ${(r.tick*r.rp.range.tickMs/1000).toFixed(2)} s · tick ${r.tick} / ${r.rp.range.toTick}</p>
${f.gaps.length?`<p class="unknown-text" data-testid="replay-gaps">${icon('info',14)}${f.gaps.map(g=>`${tr('Khoảng trống telemetry','テレメトリ欠落','Telemetry gap')}: ${esc(g.reason)}`).join(' · ')}</p>`:''}
<h4>${tr('Sự kiện nghiệp vụ tới thời điểm này','この時点までの業務イベント','Business events up to here')} (${f.events.length})</h4>
<ol class="replay-events" data-testid="replay-events">${last.map(e=>`<li><code>#${esc(e.sequence)}</code> ${esc(e.type)} <small>${esc(e.kind)} ${esc(e.id)}</small></li>`).join('')||`<li class="empty-inline">—</li>`}</ol>
<h4>${tr('Trạng thái đã ghi','記録された状態','Recorded state')}</h4>
<ul class="replay-entities" data-testid="replay-entities">${Object.values(f.entities).map(s=>`<li><b>${esc(s.entityId)}</b> <span class="state-text">${esc(s.quality)}</span> ${esc(sampleText(s))}</li>`).join('')||`<li class="empty-inline">${tr('Không có telemetry ghi lại','記録テレメトリなし','No recorded telemetry')}</li>`}</ul>
${selected?`<h4>${tr('Trace','トレース','Trace')}: ${esc(selected)}</h4><ol class="trace-rows" data-testid="trace-rows">${trace.map(x=>`<li><span class="source-tag ${x.layer==='command'?'commanded':x.layer==='observation'||x.layer==='telemetry'?'observed':'derived'}">${esc(x.layer)}</span> tick ${x.tick} · ${esc(x.type)} <small>${esc(x.id)}${x.detail?` · ${esc(x.detail)}`:''}</small></li>`).join('')||`<li class="empty-inline">${tr('Không có bản ghi nhắc tới đối tượng này','この対象の記録なし','No record names this object')}</li>`}</ol>`:''}`;
}
export function reportSummary(report:RunReport,business=0):string {
 const s=summarizeReportV2(report),t=s.telemetry;
 return `<p class="field-help" id="twin-report-summary" data-testid="report-streams">${tr('Sự kiện nghiệp vụ (bền, từ journal)','業務イベント(永続、ジャーナル)','Business events (durable, journal)')}: <b>${s.businessEvents}</b> · ${tr('Telemetry (có thể mất, gộp)','テレメトリ(損失可・集約)','Telemetry (lossy, coalesced)')}: ${t?`<b>${t.samples}</b> ${tr('mẫu','件','samples')} (${Object.entries(t.sampleCounts).map(([k,v])=>`${esc(k)} ${v}`).join(', ')}) · drop ${t.dropped} · gap ${t.gaps}`:tr('runtime này không ghi','このランタイムは未記録','not recorded by this runtime')}${business?` · ${tr('đã nhận qua stream','ストリーム受信','streamed')} ${business}`:''}</p>`;
}
export function reportPanel(report:RunReport|null,o:{replay:ReplayState|null;previous:RunReport|null;selected:string|null;business:number}):string{
 if(!report)return '';
 const s=summarizeReportV2(report),cmp=!o.replay&&o.previous?compareRuns(o.previous,report):null;
 const streams=reportSummary(report,o.business);
 const r=o.replay;
 const replay=r?`<div class="replay" data-testid="replay-panel"><div class="replay-controls"><button class="button secondary" data-action="twin-replay-play">${icon(r.playing?'cross':'play',16)}${r.playing?tr('Dừng phát','停止','Pause'):tr('Phát','再生','Play')}</button>
<label for="twin-replay-cursor" class="visually-hidden">${tr('Vị trí xem lại (tick)','再生位置(tick)','Replay position (tick)')}</label><input id="twin-replay-cursor" type="range" min="0" max="${r.rp.range.toTick}" step="5" value="${r.tick}">
<button class="button quiet" data-action="twin-replay-exit">${icon('cross',16)}${tr('Thoát xem lại','再生を終了','Exit replay')}</button></div>
<p class="source-note">${icon('lock',14)}${tr('Chỉ đọc: xem lại không gửi lệnh, không nội suy qua khoảng trống.','読み取り専用:再生はコマンドを送らず、欠落を補間しません。','Read-only: replay sends no command and never interpolates across gaps.')}</p><div id="twin-replay-body">${replayBody(r,o.selected)}</div></div>`
  :`<button class="button secondary" data-action="twin-replay">${icon('play',16)}${tr('Xem lại (chỉ đọc)','再生(読み取り専用)','Replay (read-only)')}</button>`;
 const compare=cmp?`<div class="compare" data-testid="compare-panel"><h3>${tr('So sánh với lần chạy trước','前回の実行と比較','Compare with the previous run')}</h3><p><b>${cmp.comparable?tr('So sánh được','比較可能','Comparable'):tr('Không so sánh được','比較不可','Not comparable')}</b>${cmp.reasons.length?`: ${esc(cmp.reasons.join(', '))}`:''} · ${esc(cmp.note)}</p>
${cmp.inputs.length?`<p class="field-help">${tr('Đầu vào khác','異なる入力','Changed inputs')}: ${cmp.inputs.map(i=>`${esc(i.field)} ${esc(String(i.a).slice(0,12))} → ${esc(String(i.b).slice(0,12))}`).join(' · ')}</p>`:''}
<table class="eng-table"><thead><tr><th scope="col">KPI</th><th scope="col">${tr('Trước','前回','Previous')}</th><th scope="col">${tr('Lần này','今回','This run')}</th><th scope="col">Δ</th><th scope="col">${tr('Đơn vị','単位','Unit')}</th></tr></thead><tbody>${cmp.kpis.map(k=>`<tr><th scope="row" title="${esc(k.definition)}">${esc(k.id)}</th><td>${k.a===null?`<span class="unknown-text">${tr('không có','なし','n/a')}</span>`:fmt(k.a)}</td><td>${k.b===null?`<span class="unknown-text">${tr('không có','なし','n/a')}</span>`:fmt(k.b)}</td><td>${k.delta===null?'—':fmt(k.delta)}</td><td>${esc(k.unit)}</td></tr>`).join('')}</tbody></table></div>`:'';
 const exports=`<div class="run-actions" role="group" aria-label="${tr('Xuất báo cáo','レポート出力','Export report')}">${['json','csv','html'].map(f=>`<button class="button quiet" data-action="twin-export" data-value="${f}">${icon('arrow',14)}${f.toUpperCase()}</button>`).join('')}</div>`;
 return `<section class="panel report-panel" data-testid="report-panel" aria-labelledby="report-title"><div class="panel-heading"><h2 id="report-title">${tr('Xem lại & báo cáo','再生とレポート','Replay & report')}</h2><span class="pill">${esc(s.evidence)}</span></div>${streams}${replay}${compare}${exports}<button class="button quiet" data-action="twin-save-evidence">${tr('Lưu báo cáo bất biến','不変レポートを保存','Save immutable report')}</button></section>`;
}
