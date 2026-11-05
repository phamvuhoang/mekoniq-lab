// Twin workspace: persistent mode/backend/revision bar, scene (2D plan or optional 3D), layers + legend, entity list, operations and
// engineering panels. All execution goes through TwinRuntime; selection/layers/view are local view state only.
import {httpTwinRuntime,TwinRuntimeError,type RunReport,type RunView,type TwinHealth,type TwinRuntime} from '../scenarios/controls';
import {presets,presetById,nameOf,type TwinPreset} from '../scenarios/catalog';
import {preflight,ready} from '../scenarios/preflight';
import {renderTwin,sceneEntities,kindLabel,type TwinFrame,type ViewState} from '../twin/scene';
import {defaultLayers,LAYERS,layerLabel,legend,toggleLayer,type Layer} from '../twin/overlays';
import {selectEntity,selectedEntity,onSelection} from '../twin/selection';
import {inspect} from '../twin/inspector';
import {currentCup,reconcilable} from '../twin/coffee-cell';
import {operationsPanel,statusText} from './operations-panel';
import {engineeringPanel} from './engineering-panel';
import type {Twin3d} from '../viewer/twin3d';
import {icon,esc} from './icons';
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
 private tokenDraft='';private busy=false;private playing=false;private notice='';private fault='cup-removed';private confirming:string|null=null;
 constructor(private rerender:()=>void,private rt:TwinRuntime=httpTwinRuntime()){
  onSelection(id=>{this.vs={...this.vs,selected:id};this.rerender();});
 }
 private frame():TwinFrame {return {preset:this.runPreset??this.preset,view:this.view,report:this.report};}
 async checkHealth(){try{this.health=await this.rt.health();}catch{this.health=null;}this.healthChecked=true;this.probing=false;this.rerender();}
 private bar(){
  const v=this.view,p=this.runPreset??this.preset,m=this.report?.manifest,r=v?.run;
  const badge=r?r.mode.toUpperCase():tr('CHƯA CHẠY','未実行','NOT RUN');
  const cup=currentCup(v);
  const item=(label:string,value:string,id='')=>`<span class="twin-bar-item"${id?` data-testid="${id}"`:''}><small>${label}</small><b>${esc(value)}</b></span>`;
  return `<div class="twin-bar" role="region" aria-label="${tr('Chế độ, backend và revision của lần chạy','実行のモード・バックエンド・リビジョン','Run mode, backends and revisions')}">
<span class="twin-mode ${r?'live':''}" data-testid="mode-badge">${icon(r?'lock':'info',14)}${esc(badge)}${r?` · ${esc(r.access)}`:''}</span>
<span class="twin-identity" data-testid="run-identity">${r?[`${r.backendSetId}`,(m?.backends??r.backends.map(id=>({id,version:'?'}))).map(b=>`${b.id}@${b.version}`).join(', '),`model ${v!.model}`,`${r.scenarioId} r${r.scenarioRevision}`,`seed ${r.seed}`,`project ${p.project.id} r${m?.project.revision??p.project.revision}`,`world r${m?.world.revision??p.project.world.revision}`,...(p.recipes.length?[`recipe ${p.recipes.join(' / ')}`]:[]),`source ${r.sourceCommit.slice(0,7)}`].map(x=>`<span>${esc(x)}</span>`).join(''):`<span>${esc(p.scenarioId)} · ${esc(p.backendSetId)} · ${tr('chưa khóa','未固定','not locked')}</span>`}</span>
${r?`${item(tr('Trạng thái','状態','Status'),statusText(r.status),'run-status')}${item(tr('Thời gian mô phỏng','シミュレーション時間','Sim time'),`${(Number(v!.simTimeNs)/1e9).toFixed(1)} s`,'run-tick')}${item('Run rev.',String(r.runRevision),'run-revision')}${item(tr('Đã giao','提供数','Served'),v!.served,'run-served')}<span class="twin-bar-item"><small>${tr('Cốc hiện tại','現在のカップ','Current cup')}${cup?` ${esc(cup.cupId)}`:''}</small><b data-testid="cup-owner">${cup?esc(nameOf(p,cup.ownerId)):'—'}</b></span><span class="twin-run-id" data-testid="run-id">${esc(r.id)}</span>`:''}
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
  const dialog=this.confirming?`<dialog id="twin-confirm" aria-labelledby="twin-confirm-title"><h2 id="twin-confirm-title">${tr('Xác nhận đối soát','照合の確認','Confirm reconciliation')}</h2><p>${tr(`Đối soát ${esc(this.confirming)}: runtime hỏi thiết bị theo command id, ghi kết quả và loại bỏ cốc (quarantine). Không pha lại, không gửi lại lệnh. Chỉ xác nhận sau khi đã kiểm tra tại trạm.`,`${esc(this.confirming)} を照合:コマンドIDで機器に問い合わせ、記録してカップを隔離します。再抽出・再送はしません。現場確認後のみ確認してください。`,`Reconcile ${esc(this.confirming)}: the runtime queries the device by command id, records the answer and quarantines the cup. Nothing is re-poured or resent. Confirm only after checking the station.`)}</p><div class="dialog-actions"><button class="button quiet" data-action="twin-confirm-cancel">${tr('Hủy','キャンセル','Cancel')}</button><button class="button primary" data-action="twin-confirm-ok">${icon('check',16)}${tr('Xác nhận đã kiểm tra','確認済みとして実行','Confirm checked')}</button></div></dialog>`:'';
  return `${this.bar()}${this.notice?`<div class="notice" role="status">${icon('info',17)}<span>${esc(this.notice)}</span><button aria-label="${tr('Đóng','閉じる','Dismiss')}" data-action="twin-dismiss">${icon('cross',16)}</button></div>`:''}
<div class="twin-top">${presetsHtml}${this.pairForm()}</div>
<div class="twin-grid">${scene}<div class="twin-side">${ops}<section class="panel" aria-labelledby="ent-title"><div class="panel-heading"><h2 id="ent-title">${tr('Đối tượng','対象','Objects')}</h2><span class="pill">${ents.length}</span></div>${list}</section></div>${eng}</div>${dialog}`;
 }
 /** After the host HTML is replaced: modal dialog, optional 3D view. The 2D plan is already in the DOM and stays the fallback. */
 mounted(){
  const token=document.getElementById('twin-pair-token') as HTMLInputElement|null;if(token&&this.tokenDraft)token.value=this.tokenDraft;
  // the local runtime is only probed from a local origin, once, when the twin page is first shown
  if(!this.healthChecked&&!this.probing&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)){this.probing=true;void this.checkHealth();}
  if(this.confirming){const d=document.getElementById('twin-confirm') as HTMLDialogElement|null;if(d&&!d.open)d.showModal();d?.addEventListener('cancel',()=>{this.confirming=null;},{once:true});}
  const stage=document.getElementById('twin-stage');
  if(!stage||this.vs.view!=='3d'||this.webglFailed)return;
  if(this.viewer){stage.replaceChildren(this.viewer.canvas);this.viewer.update(this.frame(),this.vs);return;}
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
 leave(){this.playing=false;this.viewer?.dispose();this.viewer=null;}
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
 private async apply(v:RunView){this.view=v;this.track(v);try{this.report=await this.rt.report(v.run.id);}catch{this.report=null;}}
 private act(kind:Parameters<TwinRuntime['action']>[1],payload?:Record<string,unknown>){return this.rt.action(this.view!,kind,payload).then(v=>this.apply(v));}
 private async create(p:TwinPreset){
  if(!this.health)throw new TwinRuntimeError('RUNTIME_UNAVAILABLE',[],0);
  this.view=null;this.report=null;this.seen={};this.runPreset=p;
  const v=await this.rt.create({project:structuredClone(p.project),scenarioId:p.scenarioId,scenarioRevision:p.scenarioRevision,seed:p.seed,mode:'mock',backendSetId:p.backendSetId,access:'simulated'},{sourceCommit:this.health.sourceCommit,schemaHash:this.health.schemaHash});
  await this.apply(v);await this.act('start');await this.act('step',{ticks:STEP_TICKS});
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
  if(action==='twin-run')return void this.call(()=>this.create(this.preset));
  if(action==='twin-rerun')return void this.call(()=>this.create(this.runPreset??this.preset));
  if(!this.view)return;
  if(action==='twin-step')return void this.call(()=>this.act('step',{ticks:STEP_TICKS}));
  if(action==='twin-play')return void this.play();
  if(action==='twin-stop'){this.playing=false;return this.rerender();}
  if(action==='twin-cancel')return void this.call(()=>this.act('cancel'));
  if(action==='twin-fault')return void this.call(()=>this.act('injectFault',{faultId:this.fault}));
  if(action==='twin-reconcile'){const a=this.view.attention.find(x=>reconcilable(x,this.view!));this.confirming=a?.subjectId??null;return this.rerender();}
  if(action==='twin-confirm-cancel'){this.confirming=null;return this.rerender();}
  if(action==='twin-confirm-ok'&&this.confirming){const subjectId=this.confirming;this.confirming=null;return void this.call(()=>this.act('reconcile',{subjectId}));}
 }
 change(id:string,value:string){if(id==='twin-fault')this.fault=value;}
 submit(form:HTMLFormElement){
  if(form.id!=='twin-pair-form')return false;
  const token=(form.querySelector('#twin-pair-token') as HTMLInputElement).value;this.tokenDraft='';
  void this.call(async()=>{if(!this.health)await this.checkHealth();await this.rt.pair(token);this.notice=tr('Runtime v2 đã ghép nối.','ランタイムv2とペアリングしました。','Runtime v2 paired.');});
  return true;
 }
 get selected(){return selectedEntity();}
}
