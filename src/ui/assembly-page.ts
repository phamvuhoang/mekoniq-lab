// Engineering assembly page: pick parts, mount and connect them, see what is wrong, compile on the runtime, look at the compiler's own scene, save and export.
// The design lives in one EngineeringProjectStore; the offline preview below is structural only, and only a server receipt says a design compiled.
import type {BundleReceipt,Bom,CompiledScene,EngineeringProject} from '../shared/engineering';
import {EngineeringProjectStore} from '../project/engineering-store';
import {EngineeringProjectRepository} from '../project/engineering-repository';
import {checkArchive} from '../project/engineering-archive';
import {addInstance,archiveFor,catalogFromArchive,connect,disconnect,mergeCatalog,parseArchive,previewProblems,referenceCatalog,referenceProject,removeInstance,serializeArchive,uniqueInstanceId,type AssemblyCatalog} from '../design/assembly';
import {buildEngineeringCandidate} from '../deployment/engineering-bundle';
import {httpTwinRuntime,type TwinRuntime} from '../scenarios/controls';
import {loadBom,loadCompiledScene} from '../scenarios/engineering';
import {hashJson} from '../twin/hash';
import {tr} from '../i18n';
import {esc} from './icons';

type SaveState='idle'|'saved'|'saving'|'error';
const short=(d:string|null)=>d?d.slice(0,12):'—';
export class AssemblyWorkspace {
  private catalog:AssemblyCatalog=referenceCatalog();
  private store:EngineeringProjectStore;
  private repository=new EngineeringProjectRepository();
  private receipt:BundleReceipt|null=null;
  private bom:Bom|null=null;
  private scene:CompiledScene|null=null;
  private canCompile:boolean|null=null;
  private saveState:SaveState='idle';
  private message='';
  private busy=false;
  private restored=false;
  private disposeScene:(()=>void)|null=null;
  constructor(private readonly rerender:()=>void,private readonly rt:TwinRuntime=httpTwinRuntime(),private readonly download:(name:string,data:string)=>void=()=>{}) {
    // a new draft: the reference world and entities, no parts chosen yet, so every blocker is visible from the start
    const base=referenceProject();
    this.store=new EngineeringProjectStore({...base,assembly:{instances:[],connections:[]},entityBindings:base.runtimeProject.entities.map(e=>({entityId:e.id,instanceIds:[]}))});
    this.store.subscribe(()=>{this.scheduleSave();});
  }
  private design():EngineeringProject {return this.store.snapshot();}
  /** Digest of the design as it is now; the same value a compile receipt and a run's engineering reference carry. */
  projectDigest():string {return hashJson(this.design());}
  private stale():boolean {return !!this.receipt&&this.receipt.projectDigest!==hashJson(this.design());}
  private edit(change:(p:EngineeringProject)=>EngineeringProject):void {this.store.replaceDraft(change(this.store.getDraft()));this.rerender();}
  private saveTimer:ReturnType<typeof setTimeout>|null=null;
  private scheduleSave():void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveState='saving';
    this.saveTimer=setTimeout(()=>{void this.save();},250);
  }
  /** Storage trouble never loses the draft: it stays in memory, the state says so, and export still works. */
  private async save():Promise<void> {
    try {await this.repository.save(archiveFor(this.design(),this.catalog));this.saveState='saved';}
    catch (e) {this.saveState='error';this.message=e instanceof Error?e.message:String(e);}
    this.rerender();
  }
  private async restore():Promise<void> {
    if (this.restored) return;
    this.restored=true;
    try {
      const saved=await this.repository.loadActive();
      if (saved&&checkArchive(saved).ok) this.open(saved,'reset');
    } catch {/* no stored draft, or storage unavailable: start fresh */}
    try {this.canCompile=!!(await this.rt.health()).capabilities?.includes('engineering_bundle_v1');} catch {this.canCompile=false;}
    this.rerender();
  }
  /** Takes everything the archive holds into the catalog (nothing is dropped) and opens its project with the identity it was saved with. */
  private open(archive:ReturnType<typeof archiveFor>,how:'load'|'reset'):void {
    mergeCatalog(this.catalog,catalogFromArchive(archive));
    if (how==='reset') this.store.reset(archive.manifest.project); else this.store.load(archive.manifest.project);
    this.receipt=null;this.bom=null;this.scene=null;
  }
  html():string {
    const p=this.design(),problems=previewProblems(p,this.catalog),archive=archiveFor(p,this.catalog);
    const owner=(id:string)=>p.entityBindings.find(b=>b.instanceIds.includes(id))?.entityId??'—';
    const ports=p.assembly.instances.flatMap(i=>(this.catalog.components[i.componentDigest]?.ports??[]).map(x=>({value:`${i.id}/${x.id}`,label:`${i.id}/${x.id} · ${x.kind} · ${x.mate}`,kind:x.kind})));
    const option=(o:{value:string;label:string})=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`;
    const chip=(text:string,tone='')=>`<span class="chip ${tone}">${esc(text)}</span>`;
    const parts=Object.entries(this.catalog.components).map(([digest,c])=>`<tr><td>${esc(c.identity.family)}<br><small>${esc(c.id)}</small></td><td>${chip(c.identity.status)} ${c.identity.sku?esc(c.identity.sku):`<small>${tr('chưa có SKU','SKU未定','no SKU')}</small>`}</td><td>${c.links.length?`${c.links.reduce((n,l)=>n+l.massKg.value,0).toFixed(2)} kg`:`<small>${tr('chưa có thông số','パラメータなし','no parameters')}</small>`}</td><td><button class="button quiet" data-action="asm-add" data-value="${digest}" ${this.busy?'disabled':''}>${tr('Thêm','追加','Add')}</button></td></tr>`).join('');
    const instances=p.assembly.instances.map(i=>`<tr><td>${esc(i.id)}</td><td>${esc(this.catalog.components[i.componentDigest]?.id??i.componentDigest.slice(0,8))}</td><td>${esc(owner(i.id))}</td><td><button class="button quiet" data-action="asm-remove" data-value="${esc(i.id)}">${tr('Gỡ','削除','Remove')}</button></td></tr>`).join('');
    const links=p.assembly.connections.map((c,n)=>`<li>${esc(c.kind)}: ${esc(c.from)} → ${esc(c.to)} <button class="button quiet" data-action="asm-disconnect" data-value="${n}">${tr('Ngắt','解除','Disconnect')}</button></li>`).join('');
    const shown=this.receipt&&!this.stale()?this.receipt:null;
    const receiptProblems=shown?.problems??[];
    const list=(items:{code:string;path:string;detail:string;blocking?:boolean}[])=>items.length?`<ul class="asm-problems">${items.map(x=>`<li data-code="${esc(x.code)}"><b>${esc(x.code)}</b> <code>${esc(x.path)}</code> ${esc(x.detail)}</li>`).join('')}</ul>`:`<p>${tr('Không có vấn đề cấu trúc trong bản xem trước. Điều này chưa có nghĩa là hợp lệ: chỉ compile trên runtime mới xác nhận.','構造上の問題はありません(プレビュー)。有効の意味ではありません: ランタイムでのコンパイルのみが確認します。','No structural problems in the preview. That does not mean valid: only a compile on the runtime confirms it.')}</p>`;
    const bom=this.bom?`<table class="asm-bom"><thead><tr><th>${tr('Linh kiện','部品','Part')}</th><th>${tr('SL','数量','Qty')}</th><th>kg</th><th>${tr('Giá','価格','Price')}</th></tr></thead><tbody>${this.bom.lines.map(l=>`<tr><td>${esc(l.componentId)} ${l.candidate?chip(tr('ứng viên','候補','candidate')):''}</td><td>${l.qty}</td><td>${l.massKg===null?'—':(l.massKg*l.qty).toFixed(2)}</td><td>${l.price?`${l.price.amount} ${esc(l.price.currency)}`:tr('chưa có báo giá','見積なし','no quote')}</td></tr>`).join('')}</tbody><tfoot><tr><td>${tr('Tổng khối lượng','総質量','Total mass')}</td><td></td><td>${this.bom.lines.reduce((n,l)=>n+(l.massKg??0)*l.qty,0).toFixed(2)}</td><td>${this.bom.incompleteTotal?tr('tổng giá chưa đầy đủ','合計は不完全','price total incomplete'):''}</td></tr></tfoot></table>`:'';
    const compile=this.canCompile===false?`<p class="notice-inline" data-testid="asm-no-runtime">${tr('Runtime không có engineering_bundle_v1: vẫn thiết kế, lưu và xuất được, nhưng chưa compile.','ランタイムにengineering_bundle_v1がありません。設計・保存・書き出しは可能ですが、コンパイルはできません。','This runtime has no engineering_bundle_v1: you can still design, save and export, but not compile.')}</p>`:'';
    const receiptView=this.receipt?`<div data-testid="asm-receipt" data-state="${this.receipt.state}">${chip(this.stale()?tr('đã cũ: thiết kế đã đổi','古い: 設計変更済み','stale: design changed'):this.receipt.state,this.stale()?'warn':'')} ${this.receipt.state==='compiled'?`<small>bundle ${short(this.receipt.bundleDigest)} · scene ${short(this.receipt.sceneDigest)} · ${this.receipt.runnable?tr('chạy được','実行可','runnable'):tr('không chạy được: chưa có môi trường native được qualify','実行不可: ネイティブ未認定','not runnable: no qualified native environment')}</small>`:''}${list(receiptProblems)}</div>`:'';
    return `<section class="panel assembly-page" data-testid="assembly-page" aria-labelledby="asm-title">
<div class="panel-heading"><h2 id="asm-title">${tr('Lắp ráp kỹ thuật','エンジニアリング組立','Engineering assembly')}</h2>
<p>${tr('Bản xem trước ngoại tuyến là cấu trúc; thông số của linh kiện ứng viên là giả định cho tới khi có nguồn.','オフラインのプレビューは構造のみ。候補部品のパラメータは出典が揃うまで仮定です。','The offline preview is structural; candidate part parameters are assumptions until sourced.')}</p></div>
<div class="asm-toolbar">
<button class="button" data-action="asm-reference">${tr('Mở AMR tham chiếu FD01','FD01参照AMRを開く','Open FD01 reference AMR')}</button>
<button class="button quiet" data-action="asm-undo" ${this.busy?'disabled':''}>${tr('Hoàn tác','元に戻す','Undo')}</button>
<button class="button quiet" data-action="asm-redo">${tr('Làm lại','やり直す','Redo')}</button>
<button class="button quiet" data-action="asm-export">${tr('Xuất dự án kỹ thuật','エンジニアリング書き出し','Export engineering project')}</button>
<label class="button quiet">${tr('Nhập tệp','ファイルを読み込む','Import file')}<input id="asm-import" type="file" accept="application/json,.json" hidden></label>
<button class="button quiet" data-action="asm-candidate">${tr('Tải bản nháp ứng viên','候補ドラフト','Download candidate draft')}</button>
<button class="button primary" data-action="asm-compile" ${this.canCompile?'':'disabled'}>${tr('Compile trên runtime','ランタイムでコンパイル','Compile on runtime')}</button>
<span class="asm-status" data-testid="asm-save-state" data-state="${this.saveState}">${{idle:'',saving:tr('đang lưu…','保存中…','saving…'),saved:tr('đã lưu','保存済み','saved'),error:tr('chưa lưu: ','未保存: ','not saved: ')+esc(this.message)}[this.saveState]}</span></div>
${this.message&&this.saveState!=='error'?`<p role="status" data-testid="asm-message">${esc(this.message)}</p>`:''}
${compile}
<p class="asm-meta" data-testid="asm-meta">rev ${p.revision} · ${tr('mã thiết kế','設計ID','design')} <code data-testid="asm-digest">${short(hashJson(p))}</code> · ${archive.manifest.missingDigests.length?`<span data-testid="asm-missing">${tr('thiếu','不足','missing')} ${archive.manifest.missingDigests.length} ${tr('tệp tham chiếu','参照ファイル','referenced files')}</span>`:tr('đủ tệp tham chiếu','参照ファイルは揃っています','all referenced files present')}</p>
<div class="asm-grid"><div><h3>${tr('Linh kiện trong catalog','カタログ部品','Catalog parts')}</h3><table class="asm-parts"><tbody>${parts}</tbody></table></div>
<div><h3>${tr('Linh kiện đã dùng','使用中の部品','Parts in this design')}</h3><table data-testid="asm-instances"><tbody>${instances||`<tr><td>${tr('Chưa có linh kiện nào.','部品がありません。','No parts yet.')}</td></tr>`}</tbody></table>
<h3>${tr('Kết nối','接続','Connections')}</h3><ul data-testid="asm-connections">${links}</ul>
<form id="asm-connect" class="asm-connect"><label>${tr('Từ cổng','元ポート','From port')}<select name="from">${ports.map(option).join('')}</select></label> <label>${tr('Tới cổng','先ポート','To port')}<select name="to">${ports.map(option).join('')}</select></label> <label>${tr('Loại','種類','Kind')}<select name="kind"><option value="mount">mount</option><option value="power">power</option><option value="data">data</option></select></label> <button class="button" type="submit">${tr('Kết nối','接続','Connect')}</button></form></div></div>
<h3>${tr('Vấn đề cần xử lý','対処が必要な問題','Blockers')}</h3><div data-testid="asm-problems">${list(problems)}</div>
<h3>${tr('Kết quả compile','コンパイル結果','Compile result')}</h3>${receiptView}${bom}
<div id="asm-scene" data-testid="asm-scene" class="asm-scene" role="img" aria-label="${tr('Cảnh đã compile','コンパイル済みシーン','Compiled scene')}">${this.scene?'':tr('Chưa có cảnh: compile để xem hình học do compiler tạo ra.','シーンなし: コンパイルするとコンパイラ生成のジオメトリを表示します。','No scene yet: compile to see the compiler\'s own geometry.')}</div></section>`;
  }
  mounted():void {
    void this.restore();
    const importer=document.getElementById('asm-import') as HTMLInputElement|null;
    importer?.addEventListener('change',()=>{const file=importer.files?.[0];if (file) void this.importFile(file);});
    const holder=document.getElementById('asm-scene');
    if (holder&&this.scene) void this.drawScene(holder,this.scene);
  }
  leave():void {this.disposeScene?.();this.disposeScene=null;}
  click(action:string,value?:string):void {
    switch (action) {
      case 'asm-reference': this.openReference();break;
      case 'asm-add': if (value) this.edit(p=>addInstance(p,value,uniqueInstanceId(p,this.catalog.components[value]!.id.replace(/-ref$/,'')),p.runtimeProject.entities[0]?.id));break;
      case 'asm-remove': if (value) this.edit(p=>removeInstance(p,value));break;
      case 'asm-disconnect': this.edit(p=>disconnect(p,Number(value)));break;
      case 'asm-undo': this.store.undo();this.rerender();break;
      case 'asm-redo': this.store.redo();this.rerender();break;
      case 'asm-export': this.exportDesign();break;
      case 'asm-candidate': void this.candidate();break;
      case 'asm-compile': void this.compile();break;
    }
  }
  submit(form:HTMLFormElement):boolean {
    if (form.id!=='asm-connect') return false;
    const data=new FormData(form),from=String(data.get('from')??''),to=String(data.get('to')??'');
    if (from&&to&&from!==to) this.edit(p=>connect(p,from,to,String(data.get('kind')) as 'mount'|'power'|'data'));
    return true;
  }
  private openReference():void {
    // additive: components of a design opened earlier stay available, so undo can come back to it
    mergeCatalog(this.catalog,referenceCatalog());
    this.store.load(referenceProject());
    this.receipt=null;this.bom=null;this.scene=null;this.message='';
    this.rerender();
  }
  private exportDesign():void {
    // from memory, not storage: a failed save must never take the export with it
    const text=serializeArchive(archiveFor(this.design(),this.catalog));
    this.download(`${this.design().id}.engineering.json`,text);
  }
  private async importFile(file:File):Promise<void> {
    try {
      if (file.size>10*1024*1024) throw new Error('ARCHIVE_TOO_LARGE');
      const archive=parseArchive(await file.text()),checked=checkArchive(archive);
      if (!checked.ok) throw new Error(checked.problems.slice(0,3).join('; '));
      this.open(archive,'load');
      this.message=checked.missing.length?tr('Đã mở bản nháp thiếu tệp; chưa thể chạy.','ファイル不足のドラフトを開きました。実行できません。','Opened a draft with missing files; it cannot run.'):'';
    } catch (e) {this.message=tr('Không nhập được: ','読み込めません: ','Could not import: ')+(e instanceof Error?e.message:String(e));}
    this.rerender();
  }
  private async candidate():Promise<void> {
    const current=this.receipt&&!this.stale()?this.receipt:null;
    this.download(`${this.design().id}.engineering-candidate.json`,JSON.stringify(await buildEngineeringCandidate(this.design(),current,[]),null,2));
  }
  private async compile():Promise<void> {
    if (!this.rt.compileEngineering||this.busy) return;
    this.busy=true;this.message='';this.rerender();
    try {
      const project=this.design(),receipt=await this.rt.compileEngineering(project);
      this.receipt=receipt;this.bom=null;this.scene=null;
      if (receipt.state==='compiled') {
        this.bom=await loadBom(this.rt,receipt.bundleDigest);
        this.scene=await loadCompiledScene(this.rt,receipt.bundleDigest);
      }
    } catch (e) {this.message=(e as {code?:string}).code??(e instanceof Error?e.message:String(e));}
    finally {this.busy=false;this.rerender();}
  }
  private async drawScene(holder:HTMLElement,scene:CompiledScene):Promise<void> {
    this.disposeScene?.();
    try {
      const THREE=await import('three'),{renderEngineeringScene}=await import('../viewer/engineering-scene');
      const canvas=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
      const w=holder.clientWidth||600,h=320;renderer.setSize(w,h);renderer.setClearColor(0x10151b);
      const root=renderEngineeringScene(scene),camera=new THREE.PerspectiveCamera(45,w/h,0.01,50),box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()).length()||1,centre=box.getCenter(new THREE.Vector3());
      camera.position.set(centre.x+size,centre.y+size*0.8,centre.z+size);camera.lookAt(centre);
      const stage=new THREE.Scene();stage.add(root,new THREE.AmbientLight(0xffffff,1.2),new THREE.DirectionalLight(0xffffff,2.2));
      renderer.render(stage,camera);
      holder.replaceChildren(canvas);holder.dataset.links=String(scene.links.length);
      this.disposeScene=()=>renderer.dispose();
    } catch {holder.textContent=tr('Không dựng được WebGL: danh sách link của cảnh vẫn có trong bundle.','WebGLを利用できません。リンク一覧はバンドルにあります。','WebGL is unavailable; the scene\'s links are still in the bundle.');}
  }
}
