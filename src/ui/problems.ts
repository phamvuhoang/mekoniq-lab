// One problems list for the twin page (D64): failing preflight items, run attention and a lost runtime link, each with a sentence, its
// reason codes and, when there is one, the object it is about (a notice is not a problem: it stays in the viewport banner). Pure: the counts and rows only explain, the runtime decides.
import type {RunView,TwinHealth} from '../scenarios/controls';
import type {preflight} from '../scenarios/preflight';
import type {LinkState} from '../runtime/stream';
import {explain,reconcilable} from '../twin/coffee-cell';
import type {NextAction} from './operations-panel';
import {nameOf,type TwinPreset} from '../scenarios/catalog';
import {icon,esc} from './icons';
import {tr} from '../i18n';
/** `entityName`: the object's display name (nameOf), shown on its button. */
export interface Problem {id:string;severity:'blocker'|'attention';text:string;codes:string[];entityId?:string;entityName?:string;action?:{id:string;label:string}}
const SEVERITIES:Problem['severity'][]=['blocker','attention'];
const runtimeBox=()=>({id:'twin-runtime-toggle',label:tr('Mở hộp runtime','ランタイムを開く','Open runtime')});
/** Blockers, then attention; input order within each group. `preset` names the objects. */
export function collectProblems(i:{paired:boolean;health:TwinHealth|null;healthChecked:boolean;checks:ReturnType<typeof preflight>;view:RunView|null;linkState:LinkState;preset?:TwinPreset}):Problem[]{
 const p:Problem[]=[];
 // pairing stands between the user and a run only before one starts (no view, or a run still `ready`); a saved report or replay needs no runtime
 if(!i.paired&&(!i.view||i.view.run.status==='ready'))p.push(i.healthChecked&&!i.health
  ?{id:'runtime',severity:'blocker',text:tr('Không thấy runtime /lab/v2 trên máy này. Khởi động runtime rồi ghép nối.','このマシンで/lab/v2ランタイムが見つかりません。起動してからペアリングしてください。','No /lab/v2 runtime found on this machine. Start the runtime, then pair.'),codes:['RUNTIME_UNREACHABLE'],action:runtimeBox()}
  :{id:'runtime',severity:'blocker',text:tr('Chưa ghép nối runtime: nhập mã một lần in trong terminal của runtime.','ランタイム未ペアリング:ターミナルのワンタイムコードを入力してください。','The runtime is not paired: enter the one-time code printed by its terminal.'),codes:['NOT_PAIRED'],action:runtimeBox()});
 // the pairing row stands for the items that need a paired runtime or its health answer; the rest are listed as they are
 const covered=(id:string)=>id==='paired'||!i.paired&&(id==='readiness'||!i.health&&id==='runtime')||!i.health&&['protocol','backend','scenario','readiness'].includes(id);
 for(const c of i.checks)if(!c.ok&&!covered(c.id))p.push({id:`check-${c.id}`,severity:'blocker',text:`${c.label}: ${c.detail}`,codes:c.codes??[],...c.entityId?{entityId:c.entityId,entityName:nameOf(i.preset,c.entityId)}:{}});
 if(['session_lost','run_lost','runtime_lost'].includes(i.linkState))p.push({id:'link',severity:'blocker',codes:[`LINK_${i.linkState.toUpperCase()}`],
  text:i.linkState==='session_lost'?tr('Runtime đã mất phiên; ghép nối lại.','ランタイムのセッションが失われました。再ペアリングしてください。','The runtime lost the session; pair again.'):i.linkState==='run_lost'?tr('Runtime không còn lần chạy này; báo cáo cuối vẫn xem được.','ランタイムにこの実行がありません。最後のレポートは閲覧できます。','The runtime no longer has this run; the last report stays viewable.'):tr('Mất kết nối tới runtime; không có mẫu mới.','ランタイムとの接続が失われました。新しいサンプルはありません。','The runtime connection is lost; no new samples arrive.'),
  ...i.linkState==='session_lost'?{action:runtimeBox()}:{}});
 const v=i.view;
 for(const [n,a] of (v?.attention??[]).entries()){const x=explain(a);
  p.push({id:`attention-${n}`,severity:'attention',text:`${x.observed} ${x.action}`,codes:[a.reason],...x.entities[0]?{entityId:x.entities[0],entityName:nameOf(i.preset,x.entities[0])}:{},...reconcilable(a,v!)?{action:{id:'twin-reconcile',label:tr('Đối soát','照合','Reconcile')}}:{}});}
 return SEVERITIES.flatMap(s=>p.filter(x=>x.severity===s));
}
const sevLabel=(s:Problem['severity'])=>({blocker:tr('Chặn','ブロック','Blocker'),attention:tr('Cần kiểm tra','要確認','Attention')})[s];
/** A button to the problem's object: its display name, and the name in its accessible label. */
export const entityButton=(id:string,name:string,testid='')=>`<button class="text-button"${testid?` data-testid="${testid}"`:''} data-action="twin-select" data-value="${esc(id)}" aria-label="${tr('Xem','表示','Show')} ${esc(name)}">${icon('pin',14)}${esc(name)}</button>`;
/** The run bar's problems box. `chains` (problem id -> its attention chain) are drawn inside that problem's card, whose object buttons they carry. Closed or empty: hidden. */
export function problemsPanel(p:readonly Problem[],open:boolean,chains:Readonly<Record<string,string>>={}):string{
 return `<div class="twin-popover twin-problems-box" id="twin-problems" data-testid="problems-panel" role="group" aria-label="${tr('Vấn đề','問題','Problems')}"${open&&p.length?'':' hidden'}><h3>${tr('Vấn đề','問題','Problems')}</h3><ol class="problem-list">${p.map(x=>`<li class="problem" data-testid="problem-row" data-severity="${x.severity}"><span class="problem-severity">${icon('cross',14)}${sevLabel(x.severity)}</span><span class="problem-text">${esc(x.text)}</span>${x.codes.length?`<span class="problem-codes">${x.codes.map(c=>`<code>${esc(c)}</code>`).join(' ')}</span>`:''}${chains[x.id]??''}<span class="problem-actions">${x.entityId&&!chains[x.id]?entityButton(x.entityId,x.entityName??x.entityId):''}${x.action?`<button class="text-button" data-action="${esc(x.action.id)}">${esc(x.action.label)}</button>`:''}</span></li>`).join('')}</ol></div>`;
}
/** The viewport strip: the recommended step when it needs a person, with the codes of the first problem behind it. No button: its action is the run bar's primary action. */
export function nextStrip(p:readonly Problem[],next:NextAction):string{
 if(!next.action)return '';
 const codes=p[0]?.codes??[];
 return `<div class="next-action" data-testid="next-action" role="status"><span class="eyebrow">${tr('BƯỚC TIẾP THEO','次の操作','NEXT ACTION')}</span><b>${esc(next.title)}</b>${codes.map(c=>`<code>${esc(c)}</code>`).join(' ')}<span>${esc(next.detail)}</span></div>`;
}
