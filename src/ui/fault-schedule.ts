import {tr} from '../i18n';
import {esc} from './icons';
import {scheduledFaults,type FaultScheduleEntry} from '../scenarios/fault-schedule';
import type {LabProjectV2} from '../shared/types';
export interface ScheduleDraft {faultId:string;targetId:string;trigger:'elapsed_sim_ms'|'phase';value:string;durationMs:string}
export function faultScheduleEditor(project:LabProjectV2,draft:ScheduleDraft,disabled:boolean):string{
 const off=disabled?'disabled':'',f=scheduledFaults.find(f=>f.id===draft.faultId),targets=project.entities.filter(t=>t.kind===f?.kind);
 const choices=scheduledFaults.filter(f=>project.entities.some(e=>e.kind===f.kind));
 return `<details class="panel" data-testid="fault-schedule"><summary>${tr('Lịch lỗi cho lần chạy mới (mock)','新しい実行の障害予定(モック)','Fault schedule for new run (mock)')}</summary><p>${tr('Thời lượng là cửa sổ chèn lỗi; hết hạn không tự sửa cốc hoặc xóa interlock. Native chưa hỗ trợ sẽ bị từ chối.','期間終了でカップやインターロックは復旧しません。未対応のネイティブ障害は拒否されます。','Duration is the injection window; expiry does not repair custody or clear interlocks. Unsupported native faults are rejected.')}</p>
 <label>${tr('Lỗi','障害','Fault')}<select id="twin-schedule-fault" ${off}>${choices.map(f=>`<option value="${f.id}" ${f.id===draft.faultId?'selected':''}>${f.id}</option>`).join('')}</select></label>
 <label>${tr('Đối tượng','対象','Target')}<select id="twin-schedule-target" ${off}>${targets.map(t=>`<option value="${esc(t.id)}" ${t.id===draft.targetId?'selected':''}>${esc(t.id)}</option>`).join('')}</select></label>
 <label>${tr('Kích hoạt','トリガー','Trigger')}<select id="twin-schedule-trigger" ${off}><option value="elapsed_sim_ms" ${draft.trigger==='elapsed_sim_ms'?'selected':''}>${tr('Thời gian mô phỏng (ms)','模擬時間(ms)','Simulation time (ms)')}</option><option value="phase" ${draft.trigger==='phase'?'selected':''}>${tr('Giai đoạn','フェーズ','Phase')}</option></select></label>
 ${draft.trigger==='phase'?`<select id="twin-schedule-value" aria-label="${tr('Giai đoạn','フェーズ','Phase')}" ${off}>${['brew','grasp','handoff','delivery'].map(p=>`<option ${p===draft.value?'selected':''}>${p}</option>`).join('')}</select>`:`<input id="twin-schedule-value" aria-label="${tr('Thời gian mô phỏng (ms)','模擬時間(ms)','Simulation time (ms)')}" type="number" min="0" max="3600000" value="${esc(draft.value)}" ${off}>`}
 <label>${tr('Thời lượng (ms)','期間(ms)','Duration (ms)')}<input id="twin-schedule-duration" type="number" min="1" max="60000" value="${esc(draft.durationMs)}" ${off}></label>
 <button data-action="twin-schedule-add" class="button quiet" ${off}>${tr('Thêm lỗi','追加','Add fault')}</button><button data-action="twin-schedule-save" class="button quiet" ${off}>${tr('Lưu project','プロジェクト保存','Save project')}</button><button data-action="twin-schedule-load" class="button quiet" ${off}>${tr('Mở project đã lưu','保存済みを開く','Load saved project')}</button><button data-action="twin-project-export" class="button quiet" ${off}>${tr('Xuất project','エクスポート','Export project')}</button>
 <label>${tr('Nhập project JSON','プロジェクトJSONを読む','Import project JSON')}<input id="twin-project-import" type="file" accept="application/json,.json" ${off}></label>
 <ol>${(project.faultSchedule??[]).map(e=>`<li>${esc(e.faultId)} · ${esc(e.targetId)} · ${e.trigger.kind}: ${esc(String(e.trigger.value))} · ${e.durationMs}ms <button data-action="twin-schedule-remove" data-value="${esc(e.id)}" ${off}>${tr('Xóa','削除','Remove')}</button></li>`).join('')}</ol></details>`;
}
export function draftEntry(draft:ScheduleDraft,project:LabProjectV2):FaultScheduleEntry{
 const kind=scheduledFaults.find(f=>f.id===draft.faultId)?.kind,targetId=draft.targetId||project.entities.find(e=>e.kind===kind)?.id||'';
 return {id:crypto.randomUUID(),faultId:draft.faultId,targetId,trigger:draft.trigger==='phase'?{kind:'phase',value:draft.value as 'brew'}:{kind:'elapsed_sim_ms',value:Number(draft.value)},durationMs:Number(draft.durationMs)};
}
