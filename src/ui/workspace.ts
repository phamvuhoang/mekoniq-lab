// Twin workspace: persistent mode/backend/revision bar, scene (2D plan or optional 3D), layers + legend, entity list, operations and
// engineering panels. All execution goes through TwinRuntime; selection/layers/view are local view state only.
import {httpTwinRuntime,TwinRuntimeError,type RunReport,type RunView,type TwinHealth,type TwinRuntime} from '../scenarios/controls';
import {presets,presetById,nameOf,type TwinPreset} from '../scenarios/catalog';
import {preflight,ready} from '../scenarios/preflight';
import {renderTwin,sceneEntities,kindLabel,type TwinFrame,type ViewState} from '../twin/scene';
import {defaultLayers,LAYERS,layerLabel,legend,toggleLayer,type Layer} from '../twin/overlays';
import {selectEntity,selectedEntity,onSelection} from '../twin/selection';
import {inspect,identityItems} from '../twin/inspector';
import {currentCup,reconcilable} from '../twin/coffee-cell';
import {operationsPanel,statusText} from './operations-panel';
import {engineeringPanel} from './engineering-panel';
import type {Twin3d} from '../viewer/twin3d';
import {icon,esc} from './icons';
import {TwinStore} from '../twin/store';
import {freshness,type Link} from '../twin/freshness';
import {openRunStreams,type LinkState} from '../runtime/stream';
import {openReplayV2} from '../reports/replay';
import {reportCsv,reportHtml,reportJson} from '../reports/metrics';
import {reportPanel,replayBody,type ReplayState} from './report-panel';
import {tr} from '../i18n';
const STEP_TICKS=250,PLAY_TICKS=500;
export class TwinWorkspace {
 private health:TwinHealth|null=null;private healthChecked=false;private probing=false;
 private preset:TwinPreset=presets[0]!;
 /** Inputs locked at creation; the scene and bar show the run's preset, not whatever is selected afterwards. */
 private runPreset:TwinPreset|null=null;
 private view:RunView|null=null;private report:RunReport|null=null;private seen:Record<string,number>={};
 private vs:ViewState={view:innerWidth<768?'2d':'3d',layers:defaultLayers(),selected:null};
 private webglFailed=false;private viewer:Twin3d|null=null;private mounting=false;
 /** Telemetry (lossy) lives in the store; the durable view only changes from action receipts, resets and polled snapshots. */
 private store=new TwinStore();private link:Link={state:'closed',lastHeartbeatMs:null,paused:false};private streams:ReturnType<typeof openRunStreams>|null=null;private streamRun='';
 private business=0;private ticker:ReturnType<typeof setInterval>|undefined;private painted=-1;private refreshing=false;
 private replay:ReplayState|null=null;private replayTimer:ReturnType<typeof setInterval>|undefined;private previous:RunReport|null=null;
 private tokenDraft='';private busy=false;private playing=false;private notice='';private fault='cup-removed';private confirming:string|null=null;
 constructor(private rerender:()=>void,private rt:TwinRuntime=httpTwinRuntime()){
  onSelection(id=>{this.vs={...this.vs,selected:id};this.rerender();});
 }
 /** The durable view, with AMR poses taken from newer telemetry (or from the replay cursor); stale/lost telemetry is drawn as unknown. */
 private frame():TwinFrame {
  const v=this.view,base={preset:this.runPreset??this.preset,report:this.report};
  if(!v)return {...base,view:v};
  if(this.replay){const r=this.replay;return {...base,view:{...v,entities:v.entities.map(e=>{const p=r.rp.pose(e.id,r.tick);return p?{...e,pose:{x:p.x,y:p.y,yawRad:p.yawRad},path:[],quality:p.gap||p.epochChange?'stale':'valid',moving:false}:e;})}};}
  const now=performance.now();
  return {...base,view:{...v,entities:v.entities.map(e=>{const s=this.store.entity(e.id),o=s?.observed;if(!s||!o||typeof o.xM!=='number')return e;
   const fresh=freshness(s,this.link,now).state,newer=BigInt(s.seq)>=BigInt(v.tick);
   return {...e,...newer?{pose:{x:o.xM as number,y:o.yM as number,yawRad:o.yawRad as number}}:{},quality:fresh==='live'||fresh==='frozen_sim'?e.quality:'stale'};})}};
 }
 private linkText(){
  const l=this.link.state,label:Record<LinkState,string>={connecting:tr('đang kết nối','接続中','connecting'),live:'SSE',polling:tr('hỏi định kỳ','ポーリング','polling'),reconnecting:tr('đang nối lại','再接続中','reconnecting'),session_lost:tr('mất phiên · cần ghép nối lại','セッション喪失 · 再ペアリング','session lost · re-pair'),run_lost:tr('runtime không còn lần chạy này','実行が見つかりません','run no longer on runtime'),runtime_lost:tr('mất runtime','ランタイム喪失','runtime lost'),closed:tr('đã đóng','終了','closed')};
  const id=this.vs.selected&&this.store.entity(this.vs.selected)?this.vs.selected:this.view?.entities[0]?.id,s=id?this.store.entity(id):undefined,f=freshness(s,this.link,performance.now());
  const state={live:tr('mới','最新','live'),stale:tr('cũ','古い','stale'),frozen_sim:'FROZEN_SIM',disconnected:tr('mất kết nối','切断','disconnected'),unknown:tr('chưa rõ','不明','unknown')}[f.state];
  const g=this.store.gaps.length,d=this.store.stats.gapDropped+this.store.stats.dropped;
  return `${label[l]} · ${id?esc(id):'—'} ${state}${f.ageMs===null?'':` ${(f.ageMs/1000).toFixed(1)} s`}${f.reason&&f.state!=='live'?` (${esc(f.reason)})`:''}${g||d?` · gap ${g} · drop ${d}`:''}`;
 }
 /** Telemetry repaint without a full re-render: the bar chip, and the 2D plan or 3D view when samples changed. */
 private tick(){
  const chip=document.getElementById('twin-telemetry');if(chip){chip.innerHTML=this.linkText();chip.dataset.state=freshness(this.vs.selected?this.store.entity(this.vs.selected):this.store.entities()[0],this.link,performance.now()).state;}
  const n=this.store.stats.applied+this.store.stats.epochResets;if(n===this.painted&&!this.replay)return;this.painted=n;
  if(this.vs.view==='2d'){const st=document.getElementById('twin-stage');if(st)st.innerHTML=renderTwin(this.frame(),this.vs);}else this.viewer?.update(this.frame(),this.vs);
 }
 private openStreams(v:RunView){
  if(this.streamRun===v.run.id&&this.streams&&!['session_lost','run_lost','closed'].includes(this.streams.state))return;
  this.streams?.close();this.store=new TwinStore();this.business=0;this.streamRun=v.run.id;this.link={state:'connecting',lastHeartbeatMs:null,paused:false};
  this.streams=openRunStreams<RunView,Parameters<TwinStore['apply']>[0]>(v.run.id,v.run.eventCursor,{
   onSample:s=>{this.store.apply(s);},onGap:g=>this.store.gap(g as never),
   onHeartbeat:h=>{this.link={...this.link,lastHeartbeatMs:performance.now(),paused:h.paused};},
   onBusiness:e=>{this.business++;const c=this.view?.run.eventCursor;if(!this.busy&&!this.refreshing&&this.view&&(c==null||BigInt(e.sequence)>BigInt(c)))void this.refresh();},
   onReset:(snap,reason)=>{this.notice=`${tr('Đồng bộ lại từ snapshot','スナップショットから再同期','Resynchronised from a snapshot')}: ${reason}`;if(!this.busy)void this.apply(snap).then(()=>this.rerender());},
   onSnapshot:snap=>{if(!this.busy&&snap.run.runRevision!==this.view?.run.runRevision)void this.apply(snap).then(()=>this.rerender());},
   onState:st=>{this.link={...this.link,state:st};
    // telemetry is not replayed after a drop: the hole is recorded as an explicit local gap
    if(st==='reconnecting'||st==='runtime_lost')this.store.gap({reason:`LINK_${st.toUpperCase()}`});
    if(st==='session_lost'){this.rt.forget();this.playing=false;this.notice=tr('Runtime đã mất phiên (khởi động lại?). Ghép nối lại; lần chạy trong bộ nhớ không mở lại được, báo cáo cuối vẫn xem được.','ランタイムのセッションが失われました(再起動?)。再ペアリングしてください。メモリ上の実行は再開できませんが、最後のレポートは閲覧できます。','The runtime lost the session (restarted?). Pair again; the in-memory run cannot be reopened, the last report stays viewable.');this.rerender();}
    else if(st==='run_lost'||st==='runtime_lost'){this.playing=false;this.rerender();}
    else this.tick();}},
   {EventSource:this.health?.features?.sse===false?undefined:globalThis.EventSource});
  clearInterval(this.ticker);this.ticker=setInterval(()=>this.tick(),250);
 }
 /** Durable events arrived that this view does not reflect yet (e.g. another tab acted): re-read the snapshot. */
 private async refresh(){this.refreshing=true;try{if(this.view)await this.apply(await this.rt.get(this.view.run.id));this.rerender();}catch{/* keep the last snapshot */}finally{this.refreshing=false;}}
 async checkHealth(){try{this.health=await this.rt.health();}catch{this.health=null;}this.healthChecked=true;this.probing=false;this.rerender();}
 private bar(){
  const v=this.view,p=this.runPreset??this.preset,m=this.report?.manifest,r=v?.run;
  const badge=r?r.mode.toUpperCase():tr('CHƯA CHẠY','未実行','NOT RUN');
  const cup=currentCup(v);
  const item=(label:string,value:string,id='')=>`<span class="twin-bar-item"${id?` data-testid="${id}"`:''}><small>${label}</small><b>${esc(value)}</b></span>`;
  return `<div class="twin-bar" role="region" aria-label="${tr('Chế độ, backend và revision của lần chạy','実行のモード・バックエンド・リビジョン','Run mode, backends and revisions')}">
<span class="twin-mode ${r?'live':''}" data-testid="mode-badge">${icon(r?'lock':'info',14)}${esc(badge)}${r?` · ${esc(r.access)}`:''}</span>
<span class="twin-identity" data-testid="run-identity">${r?identityItems(v!,this.report).map(x=>`<span>${esc(x)}</span>`).join(''):`<span>${esc(p.scenarioId)} · ${esc(p.backendSetId)} · ${tr('chưa khóa','未固定','not locked')}</span>`}</span>
${r?`${item(tr('Trạng thái','状態','Status'),statusText(r.status),'run-status')}${item(tr('Thời gian mô phỏng','シミュレーション時間','Sim time'),`${(Number(v!.simTimeNs)/1e9).toFixed(1)} s`,'run-tick')}${item('Run rev.',String(r.runRevision),'run-revision')}${item(tr('Đã giao','提供数','Served'),v!.served,'run-served')}<span class="twin-bar-item"><small>${tr('Cốc hiện tại','現在のカップ','Current cup')}${cup?` ${esc(cup.cupId)}`:''}</small><b data-testid="cup-owner">${cup?esc(nameOf(p,cup.ownerId)):'—'}</b></span><span class="twin-bar-item"><small>Telemetry</small><b id="twin-telemetry" data-testid="twin-telemetry" aria-live="off">${this.linkText()}</b></span><span class="twin-run-id" data-testid="run-id">${esc(r.id)}</span>`:''}
</div>`;
 }
 private pairForm(){
  if(this.rt.paired)return '';
  // a re-render (e.g. the health probe landing) must not wipe a code being typed; restored in mounted(), never written to markup
  this.tokenDraft=(document.getElementById('twin-pair-token') as HTMLInputElement|null)?.value??this.tokenDraft;
  return `<form id="twin-pair-form" class="twin-pair"><label for="twin-pair-token">${tr('Mã ghép nối một lần từ terminal runtime','ランタイム端末のワンタイムペアリングコード','One-time pairing code from the runtime terminal')}</label><div class="pair-row"><input id="twin-pair-token" type="password" autocomplete="off" required><button class="button secondary" ${this.busy?'disabled':''}>${icon('link',16)}${tr('Ghép nối runtime','ランタイムをペアリング','Pair runtime')}</button></div><p class="field-help">${this.health?`source ${esc(this.health.sourceCommit.slice(0,7))}`:this.healthChecked?tr('Không thấy runtime /lab/v2. Chạy runtime trên máy phát triển; Lab không tự báo hoàn thành khi thiếu runner.','/lab/v2が見つかりません。開発機でランタイムを起動してください。','No /lab/v2 runtime found. Start the runtime on your development machine; the Lab never reports completion without a runner.'):'…'}</p></form>`;
 }
 private checks(){
  const c=preflight(this.preset,this.health,this.rt.paired);
  return `<div class="preflight" data-testid="preflight"><h3>${tr('Kiểm tra trước khi chạy','実行前チェック','Preflight')}</h3><ul>${c.map(x=>`<li class="${x.ok?'ok':'fail'}"><span class="check-mark" aria-hidden="true">${icon(x.ok?'check':'cross',14)}</span><span><b>${esc(x.label)}</b> <span class="state-text">${x.ok?tr('đạt','合格','pass'):tr('chưa đạt','未達','fail')}</span><br><small>${esc(x.detail)}</small></span>${x.entityId?`<button class="text-button" data-action="twin-select" data-value="${esc(x.entityId)}">${tr('Xem','表示','Show')}</button>`:''}</li>`).join('')}</ul></div>`;
 }
 html():string {
  const f=this.frame(),ents=sceneEntities(f),sel=this.vs.selected,insp=inspect(f,sel,this.seen),p=f.preset;
  const presetsHtml=`<div class="twin-presets" role="group" aria-label="${tr('Preset kịch bản','シナリオプリセット','Scenario presets')}">${presets.map(x=>`<button class="preset-option" data-action="twin-preset" data-value="${x.id}" aria-pressed="${x.id===this.preset.id}" aria-label="${esc(x.title())}" aria-describedby="preset-${x.id}-summary">${icon(x.id==='coffee'?'coffee':'robot',20)}<span><b>${esc(x.title())}</b><small id="preset-${x.id}-summary">${esc(x.summary())}</small></span></button>`).join('')}</div>`;
  const layers=`<div class="twin-layers" role="group" aria-label="${tr('Lớp hiển thị','表示レイヤー','Layers')}">${LAYERS.map(l=>`<button data-action="twin-layer" data-value="${l}" aria-pressed="${this.vs.layers[l]}">${layerLabel(l)}</button>`).join('')}</div>`;
  const viewSwitch=`<div class="viewer-switch" role="group" aria-label="${tr('Kiểu xem','表示形式','View')}"><button data-action="twin-view" data-value="3d" aria-pressed="${this.vs.view==='3d'}" ${this.webglFailed?'disabled':''}>3D</button><button data-action="twin-view" data-value="2d" aria-pressed="${this.vs.view==='2d'}">2D</button></div>`;
  const legendHtml=`<ul class="twin-legend" data-testid="twin-legend" aria-label="${tr('Chú giải','凡例','Legend')}">${legend().map(x=>`<li><i class="mark ${x.mark}" aria-hidden="true"></i><b>${x.label}</b><small>${x.note}</small></li>`).join('')}</ul>`;
  const list=`<ul class="entity-list" data-testid="entity-list" aria-label="${tr('Đối tượng trong twin','ツイン内の対象','Twin objects')}">${ents.map(e=>`<li><button data-action="twin-select" data-value="${esc(e.id)}" aria-pressed="${e.id===sel}"><span class="entity-kind">${esc(kindLabel(e.kind))}</span><b>${esc(e.name)}</b>${e.name!==e.id?`<small>${esc(e.id)}</small>`:''}${e.status?`<span class="state-text">${esc(e.status)}</span>`:''}</button></li>`).join('')}</ul>`;
  const scene=`<section class="panel twin-scene-panel" aria-labelledby="twin-scene-title"><div class="twin-scene-top"><h2 id="twin-scene-title" class="small-code">${esc(p.project.name)} · ${p.project.world.width} × ${p.project.world.height} m</h2>${viewSwitch}</div>${layers}
<div class="twin-stage" id="twin-stage" data-testid="twin-scene">${renderTwin(f,this.vs)}</div>
${this.webglFailed?`<p class="source-note" data-testid="twin-fallback-note" role="status">${icon('info',15)}${tr('WebGL không khả dụng · đang hiển thị mặt bằng 2D với cùng dữ liệu và lựa chọn.','WebGLを利用できません · 同じデータと選択で2D平面図を表示中。','WebGL unavailable · showing the 2D plan with the same data and selection.')}</p>`:''}
${legendHtml}<p class="source-note">${icon('info',15)}${tr('Cảnh chỉ đọc: vị trí lấy từ runtime, canvas không quyết định đến đích hay hoàn thành.','表示は読み取り専用。位置はランタイムから取得し、描画は到着や完了を判定しません。','Read-only scene: positions come from the runtime; the canvas never decides arrival or completion.')}</p></section>`;
  const ops=operationsPanel({paired:this.rt.paired,ready:ready(preflight(this.preset,this.health,this.rt.paired)),busy:this.busy,playing:this.playing,view:this.view,preset:p},this.checks());
  const eng=engineeringPanel(insp,{hasRun:!!this.view,busy:this.busy||this.playing,fault:this.fault,coffee:!!this.view?.coffee});
  const dialog=this.confirming?`<dialog id="twin-confirm" aria-labelledby="twin-confirm-title"><h2 id="twin-confirm-title">${tr('Xác nhận đối soát','照合の確認','Confirm reconciliation')}</h2><p>${tr(`Đối soát ${esc(this.confirming)}: Lab yêu cầu runtime hỏi thiết bị theo command id và ghi lại câu trả lời. Lab không gửi lại lệnh; kết quả là những gì runtime báo về sau đó. Chỉ xác nhận sau khi đã kiểm tra tại chỗ.`,`${esc(this.confirming)} を照合:LabはランタイムにコマンドIDで機器へ問い合わせ、回答を記録するよう依頼します。Labはコマンドを再送しません。結果はその後ランタイムが報告する内容です。現場確認後のみ確認してください。`,`Reconcile ${esc(this.confirming)}: the Lab asks the runtime to query the device by command id and record the answer. The Lab resends nothing; the outcome is whatever the runtime then reports. Confirm only after checking on site.`)}</p><div class="dialog-actions"><button class="button quiet" data-action="twin-confirm-cancel">${tr('Hủy','キャンセル','Cancel')}</button><button class="button primary" data-action="twin-confirm-ok">${icon('check',16)}${tr('Xác nhận đã kiểm tra','確認済みとして実行','Confirm checked')}</button></div></dialog>`:'';
  return `${this.bar()}${this.notice?`<div class="notice" role="status">${icon('info',17)}<span>${esc(this.notice)}</span><button aria-label="${tr('Đóng','閉じる','Dismiss')}" data-action="twin-dismiss">${icon('cross',16)}</button></div>`:''}
<div class="twin-top">${presetsHtml}${this.pairForm()}</div>
<div class="twin-grid">${scene}<div class="twin-side">${ops}${reportPanel(this.report,{replay:this.replay,previous:this.previous,selected:sel,business:this.business})}<section class="panel" aria-labelledby="ent-title"><div class="panel-heading"><h2 id="ent-title">${tr('Đối tượng','対象','Objects')}</h2><span class="pill">${ents.length}</span></div>${list}</section></div>${eng}</div>${dialog}`;
 }
 /** After the host HTML is replaced: modal dialog, optional 3D view. The 2D plan is already in the DOM and stays the fallback. */
 mounted(){
  if(this.view&&this.rt.paired&&!this.streams)this.openStreams(this.view);
  const token=document.getElementById('twin-pair-token') as HTMLInputElement|null;if(token&&this.tokenDraft)token.value=this.tokenDraft;
  // the local runtime is only probed from a local origin, once, when the twin page is first shown
  if(!this.healthChecked&&!this.probing&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)){this.probing=true;void this.checkHealth();}
  if(this.confirming){const d=document.getElementById('twin-confirm') as HTMLDialogElement|null;if(d&&!d.open)d.showModal();d?.addEventListener('cancel',()=>{this.confirming=null;},{once:true});}
  const stage=document.getElementById('twin-stage');
  if(!stage||this.vs.view!=='3d'||this.webglFailed)return;
  if(this.viewer){this.viewer.attach(stage);this.viewer.update(this.frame(),this.vs);return;}
  if(this.mounting)return;this.mounting=true;
  void import('../viewer/twin3d').then(({mountTwin3d})=>{
   this.mounting=false;
   const now=document.getElementById('twin-stage');if(!now||this.vs.view!=='3d')return;
   const v=mountTwin3d(now,id=>selectEntity(id),()=>this.fallback());
   if(!v)return this.fallback();
   this.viewer=v;v.update(this.frame(),this.vs);
  },()=>{this.mounting=false;this.fallback();});
 }
 private fallback(){this.viewer?.dispose();this.viewer=null;this.webglFailed=true;this.vs={...this.vs,view:'2d'};this.rerender();}
 leave(){this.playing=false;this.viewer?.dispose();this.viewer=null;this.streams?.close();this.streams=null;clearInterval(this.ticker);this.stopReplay();}
 private stopReplay(){clearInterval(this.replayTimer);this.replayTimer=undefined;if(this.replay)this.replay.playing=false;}
 private track(v:RunView){for(const c of v.coffee?.cups??[]){const k=`${c.cupId}:${c.ownerKind}:${c.ownerId}`;if(!(k in this.seen))this.seen[k]=v.tick;}}
 private async call(task:()=>Promise<void>){
  if(this.busy)return;this.busy=true;this.notice='';this.rerender();
  try{await task();}
  catch(e){
   this.playing=false;
   this.notice=e instanceof TwinRuntimeError?`${tr('Runtime từ chối','ランタイムが拒否','Runtime refused')}: ${e.message}`:e instanceof Error?e.message:String(e);
   // a refused action leaves the run as the runtime has it: re-read instead of guessing
   if(this.view)try{await this.apply(await this.rt.get(this.view.run.id));}catch{/* keep the last snapshot */}
  }finally{this.busy=false;this.rerender();}
 }
 private async apply(v:RunView){this.view=v;this.track(v);
  // the action receipt/snapshot is the pause acknowledgement; heartbeats only refresh it between receipts (e.g. another tab)
  this.link={...this.link,paused:v.run.status==='paused'};try{this.report=await this.rt.report(v.run.id);}catch{this.report=null;}if(this.report&&this.replay)this.replay={...this.replay,rp:openReplayV2(this.report)};}
 private act(kind:Parameters<TwinRuntime['action']>[1],payload?:Record<string,unknown>){return this.rt.action(this.view!,kind,payload).then(v=>this.apply(v));}
 private async create(p:TwinPreset){
  if(!this.health)throw new TwinRuntimeError('RUNTIME_UNAVAILABLE',[],0);
  this.previous=this.report;this.view=null;this.report=null;this.seen={};this.runPreset=p;this.stopReplay();this.replay=null;
  const v=await this.rt.create({project:structuredClone(p.project),scenarioId:p.scenarioId,scenarioRevision:p.scenarioRevision,seed:p.seed,mode:'mock',backendSetId:p.backendSetId,access:'simulated'},{sourceCommit:this.health.sourceCommit,schemaHash:this.health.schemaHash});
  await this.apply(v);this.openStreams(v);await this.act('start');await this.act('step',{ticks:STEP_TICKS});
 }
 private async play(){
  this.playing=true;
  await this.call(async()=>{
   while(this.playing&&this.view&&['running','awaiting_confirmation'].includes(this.view.run.status)){await this.act('step',{ticks:PLAY_TICKS});this.rerender();}
  });
  this.playing=false;this.rerender();
 }
 click(action:string,value?:string){
  if((action==='twin-select'||action==='twin-pick')&&value)return selectEntity(value);
  if(action==='twin-layer'){this.vs={...this.vs,layers:toggleLayer(this.vs.layers,value as Layer)};return this.rerender();}
  if(action==='twin-view'){if(value==='2d'){this.viewer?.dispose();this.viewer=null;}this.vs={...this.vs,view:value==='3d'&&!this.webglFailed?'3d':'2d'};return this.rerender();}
  if(action==='twin-preset'){const p=presetById(value??'');if(p&&p!==this.preset){this.preset=p;if(!this.playing){this.view=null;this.report=null;this.runPreset=null;}selectEntity(null);}return this.rerender();}
  if(action==='twin-dismiss'){this.notice='';return this.rerender();}
  if(action==='twin-export'&&this.report)return this.download(value??'json');
  if(action==='twin-replay'&&this.report){this.playing=false;this.replay={rp:openReplayV2(this.report),tick:0,playing:false};return this.rerender();}
  if(action==='twin-replay-exit'){this.stopReplay();this.replay=null;this.painted=-1;return this.rerender();}
  if(action==='twin-replay-play'&&this.replay){
   if(this.replay.playing){this.stopReplay();return this.rerender();}
   this.replay.playing=true;if(this.replay.tick>=this.replay.rp.range.toTick)this.replay.tick=0;
   // playback rate is a view setting: 10x recorded time; it never touches the runtime
   this.replayTimer=setInterval(()=>{const r=this.replay;if(!r){this.stopReplay();return;}r.tick=Math.min(r.rp.range.toTick,r.tick+25);this.scrubbed();if(r.tick>=r.rp.range.toTick){this.stopReplay();this.rerender();}},50);
   return this.rerender();
  }
  if(action==='twin-run')return void this.call(()=>this.create(this.preset));
  if(action==='twin-rerun')return void this.call(()=>this.create(this.runPreset??this.preset));
  if(!this.view)return;
  if(action==='twin-step')return void this.call(()=>this.act('step',{ticks:STEP_TICKS}));
  if(action==='twin-play')return void this.play();
  if(action==='twin-stop'){this.playing=false;return this.rerender();}
  if(action==='twin-cancel')return void this.call(()=>this.act('cancel'));
  if(action==='twin-pause')return void this.call(()=>this.act('pause'));
  if(action==='twin-resume')return void this.call(()=>this.act('resume'));
  if(action==='twin-fault')return void this.call(()=>this.act('injectFault',{faultId:this.fault}));
  if(action==='twin-reconcile'){const a=this.view.attention.find(x=>reconcilable(x,this.view!));this.confirming=a?.subjectId??null;return this.rerender();}
  if(action==='twin-confirm-cancel'){this.confirming=null;return this.rerender();}
  if(action==='twin-confirm-ok'&&this.confirming){const subjectId=this.confirming;this.confirming=null;return void this.call(()=>this.act('reconcile',{subjectId}));}
 }
 change(id:string,value:string){if(id==='twin-fault')this.fault=value;if(id==='twin-replay-cursor')this.input(id,value);}
 /** Scrub: update the replay body and the scene in place so the range input keeps focus and drag state. */
 input(id:string,value:string){if(id!=='twin-replay-cursor'||!this.replay)return;this.replay.tick=Number(value);this.scrubbed();}
 private scrubbed(){
  const r=this.replay!;const body=document.getElementById('twin-replay-body');if(body)body.innerHTML=replayBody(r,this.vs.selected);
  const range=document.getElementById('twin-replay-cursor') as HTMLInputElement|null;if(range&&document.activeElement!==range)range.value=String(r.tick);
  this.painted=-1;this.tick();
 }
 private download(format:string){
  const r=this.report!,name=`mekoniq-run-${r.manifest.scenario.id}-seed${r.manifest.seed}-${r.manifest.runId.slice(0,8)}`;
  const [body,type,ext]=format==='csv'?[reportCsv(r),'text/csv','csv']:format==='html'?[reportHtml(r,this.previous?{compareWith:this.previous}:{}),'text/html','html']:[reportJson(r),'application/json','json'];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([body],{type}));a.download=`${name}.${ext}`;a.rel='noopener';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }
 submit(form:HTMLFormElement){
  if(form.id!=='twin-pair-form')return false;
  const token=(form.querySelector('#twin-pair-token') as HTMLInputElement).value;this.tokenDraft='';
  void this.call(async()=>{if(!this.health)await this.checkHealth();await this.rt.pair(token);this.notice=tr('Runtime v2 đã ghép nối.','ランタイムv2とペアリングしました。','Runtime v2 paired.');});
  return true;
 }
 get selected(){return selectedEntity();}
}
