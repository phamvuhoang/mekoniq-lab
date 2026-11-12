// One problems list for the twin page (D64): failing preflight items, run attention, a lost runtime link and the last notice, each with a
// sentence, its reason codes and, when there is one, the object it is about. Pure: the counts and rows only explain, the runtime decides.
import type {RunView,TwinHealth} from '../scenarios/controls';
import type {preflight} from '../scenarios/preflight';
import type {LinkState} from '../runtime/stream';
import {explain,reconcilable} from '../twin/coffee-cell';
import type {NextAction} from './operations-panel';
import {icon,esc} from './icons';
import {tr} from '../i18n';
export interface Problem {id:string;severity:'blocker'|'attention'|'notice';text:string;codes:string[];entityId?:string;action?:{id:string;label:string}}
const SEVERITIES:Problem['severity'][]=['blocker','attention','notice'];
const runtimeBox=()=>({id:'twin-runtime-toggle',label:tr('Mở hộp runtime','ランタイムを開く','Open runtime')});
/** Blockers, then attention, then notices; input order within each group. */
export function collectProblems(i:{paired:boolean;health:TwinHealth|null;healthChecked:boolean;checks:ReturnType<typeof preflight>;view:RunView|null;linkState:LinkState;notice:string}):Problem[]{
 const p:Problem[]=[];
 // pairing stands between the user and a run only before one starts (no view, or a run still `ready`); a saved report or replay needs no runtime
 if(!i.paired&&(!i.view||i.view.run.status==='ready'))p.push(i.healthChecked&&!i.health
  ?{id:'runtime',severity:'blocker',text:tr('Không thấy runtime /lab/v2 trên máy này. Khởi động runtime rồi ghép nối.','このマシンで/lab/v2ランタイムが見つかりません。起動してからペアリングしてください。','No /lab/v2 runtime found on this machine. Start the runtime, then pair.'),codes:['RUNTIME_UNREACHABLE'],action:runtimeBox()}
  :{id:'runtime',severity:'blocker',text:tr('Chưa ghép nối runtime: nhập mã một lần in trong terminal của runtime.','ランタイム未ペアリング:ターミナルのワンタイムコードを入力してください。','The runtime is not paired: enter the one-time code printed by its terminal.'),codes:['NOT_PAIRED'],action:runtimeBox()});
 // the pairing row stands for the items that need a paired runtime or its health answer; the rest are listed as they are
 const covered=(id:string)=>id==='paired'||!i.paired&&(id==='readiness'||!i.health&&id==='runtime')||!i.health&&['protocol','backend','scenario','readiness'].includes(id);
 for(const c of i.checks)if(!c.ok&&!covered(c.id))p.push({id:`check-${c.id}`,severity:'blocker',text:`${c.label}: ${c.detail}`,codes:c.codes??[],...c.entityId?{entityId:c.entityId}:{}});
 if(['session_lost','run_lost','runtime_lost'].includes(i.linkState))p.push({id:'link',severity:'blocker',codes:[`LINK_${i.linkState.toUpperCase()}`],
  text:i.linkState==='session_lost'?tr('Runtime đã mất phiên; ghép nối lại.','ランタイムのセッションが失われました。再ペアリングしてください。','The runtime lost the session; pair again.'):i.linkState==='run_lost'?tr('Runtime không còn lần chạy này; báo cáo cuối vẫn xem được.','ランタイムにこの実行がありません。最後のレポートは閲覧できます。','The runtime no longer has this run; the last report stays viewable.'):tr('Mất kết nối tới runtime; không có mẫu mới.','ランタイムとの接続が失われました。新しいサンプルはありません。','The runtime connection is lost; no new samples arrive.'),
  ...i.linkState==='session_lost'?{action:runtimeBox()}:{}});
 const v=i.view;
 for(const [n,a] of (v?.attention??[]).entries()){const x=explain(a);
  p.push({id:`attention-${n}`,severity:'attention',text:`${x.observed} ${x.action}`,codes:[a.reason],...x.entities[0]?{entityId:x.entities[0]}:{},...reconcilable(a,v!)?{action:{id:'twin-reconcile',label:tr('Đối soát','照合','Reconcile')}}:{}});}
 if(i.notice)p.push({id:'notice',severity:'notice',text:i.notice,codes:[]});
 return SEVERITIES.flatMap(s=>p.filter(x=>x.severity===s));
}
const sevLabel=(s:Problem['severity'])=>({blocker:tr('Chặn','ブロック','Blocker'),attention:tr('Cần kiểm tra','要確認','Attention'),notice:tr('Thông báo','お知らせ','Notice')})[s];
/** The run bar's problems box; `detailHtml` (the attention chain) follows the rows. Closed or empty: hidden. */
export function problemsPanel(p:readonly Problem[],open:boolean,detailHtml=''):string{
 return `<div class="twin-popover twin-problems-box" id="twin-problems" data-testid="problems-panel" role="group" aria-label="${tr('Vấn đề','問題','Problems')}"${open&&p.length?'':' hidden'}><h3>${tr('Vấn đề','問題','Problems')}</h3><ol class="problem-list">${p.map(x=>`<li class="problem" data-testid="problem-row" data-severity="${x.severity}"><span class="problem-severity">${icon(x.severity==='notice'?'info':'cross',14)}${sevLabel(x.severity)}</span><span class="problem-text">${esc(x.text)}</span>${x.codes.length?`<span class="problem-codes">${x.codes.map(c=>`<code>${esc(c)}</code>`).join(' ')}</span>`:''}<span class="problem-actions">${x.entityId?`<button class="text-button" data-action="twin-select" data-value="${esc(x.entityId)}">${icon('pin',14)}${esc(x.entityId)}</button>`:''}${x.action?`<button class="text-button" data-action="${esc(x.action.id)}">${esc(x.action.label)}</button>`:''}</span></li>`).join('')}</ol>${detailHtml}</div>`;
}
/** The viewport strip: the recommended step when it needs a person, with the codes of the first problem behind it. No button: its action is the run bar's primary action. */
export function nextStrip(p:readonly Problem[],next:NextAction):string{
 if(!next.action)return '';
 const codes=p.find(x=>x.severity!=='notice')?.codes??[];
 return `<div class="next-action" data-testid="next-action" role="status"><span class="eyebrow">${tr('BƯỚC TIẾP THEO','次の操作','NEXT ACTION')}</span><b>${esc(next.title)}</b>${codes.map(c=>`<code>${esc(c)}</code>`).join(' ')}<span>${esc(next.detail)}</span></div>`;
}
