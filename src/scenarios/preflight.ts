// Preflight before a run: every item is pass/fail with a reason (text, not color) and, when it is about the project, the affected entity.
// It only explains; the runtime re-checks everything on create and is the authority.
import type {TwinHealth} from './controls';
import type {TwinPreset} from './catalog';
import {tr} from '../i18n';
export interface Check {id:string;ok:boolean;label:string;detail:string;entityId?:string}
export function preflight(p:TwinPreset,health:TwinHealth|null,paired:boolean):Check[] {
 const set=health?.backendSets.find(s=>s.id===p.backendSetId),off=set?.backends.filter(b=>!health!.backends.find(x=>x.id===b)?.enabled)??[];
 const checks:Check[]=[
  {id:'runtime',ok:!!health,label:tr('Runtime cục bộ','ローカルランタイム','Local runtime'),detail:health?`source ${health.sourceCommit.slice(0,7)} · protocol ${health.protocolMajors.join('/')}`:tr('Không kết nối được /lab/v2. Khởi động runtime trên máy phát triển.','/lab/v2に接続できません。開発機でランタイムを起動してください。','Cannot reach /lab/v2. Start the runtime on your development machine.')},
  {id:'protocol',ok:!!health?.protocolMajors.includes(2),label:'Protocol v2',detail:health?(health.protocolMajors.includes(2)?'v2':tr('Runtime không hỗ trợ v2','v2非対応','Runtime does not offer v2')):'—'},
  {id:'paired',ok:paired,label:tr('Ghép nối','ペアリング','Pairing'),detail:paired?tr('Phiên v2 đã ghép nối','v2セッション済み','v2 session paired'):tr('Nhập mã một lần từ terminal','ターミナルのワンタイムコードを入力','Enter the one-time code from your terminal')},
  {id:'backend',ok:!!set&&set.mode==='mock'&&!off.length,label:`${tr('Bộ backend','バックエンドセット','Backend set')} ${p.backendSetId}`,detail:!health?'—':!set?tr('Runtime không có bộ này','このセットなし','Set not offered by this runtime'):off.length?`${tr('Chưa bật','無効','Not enabled')}: ${off.map(b=>`${b}${health.backends.find(x=>x.id===b)?.reason?` (${health.backends.find(x=>x.id===b)!.reason})`:''}`).join(', ')}`:`${set.mode} · ${set.backends.join(', ')}`},
  {id:'scenario',ok:!!health?.scenarioIds.includes(p.scenarioId),label:`${tr('Kịch bản','シナリオ','Scenario')} ${p.scenarioId}`,detail:!health?'—':health.scenarioIds.includes(p.scenarioId)?`r${p.scenarioRevision}`:tr('Runtime không có kịch bản này','このシナリオなし','Scenario not offered by this runtime')},
 ];
 for(const kind of p.roles.entities){const e=p.project.entities.find(x=>x.kind===kind);checks.push({id:`entity-${kind}`,ok:!!e,label:`${tr('Thực thể','エンティティ','Entity')} ${kind}`,detail:e?e.id:tr('Thiếu trong dự án','プロジェクトに不足','Missing from the project'),...e?{entityId:e.id}:{}});}
 for(const kind of p.roles.points){const q=p.project.world.points.find(x=>x.kind===kind);checks.push({id:`point-${kind}`,ok:!!q,label:`${tr('Điểm','地点','Point')} ${kind}`,detail:q?`${q.name} (${q.x}, ${q.y}) m`:tr('Thiếu trong mặt bằng','レイアウトに不足','Missing from the layout')});}
 return checks;
}
export const ready=(checks:Check[])=>checks.every(c=>c.ok);
