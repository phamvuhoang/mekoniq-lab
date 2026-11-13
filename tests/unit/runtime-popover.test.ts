// U06: the runtime box (where the runtime is, its address, the one-use code, the pinned and the runtime's commit), the MuJoCo set's capability
// and the mujoco-coffee preset. Every string is checked in its three languages (tr is replaced by `vi|ja|en`).
import {expect,test,vi} from 'vitest';
vi.mock('../../src/i18n',()=>({tr:(vi:string,ja:string,en:string)=>`${vi}|${ja}|${en}`}));
vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});
vi.stubGlobal('innerWidth',600);
vi.stubGlobal('document',{getElementById:()=>null,querySelector:()=>null,activeElement:null});
const {runtimePopover}=await import('../../src/ui/run-bar');
const {backendSetOptions}=await import('../../src/scenarios/support');
const {MUJOCO_ARM_SET,presetById}=await import('../../src/scenarios/catalog');
const {TwinWorkspace}=await import('../../src/ui/workspace');
import type {TwinHealth,TwinRuntime} from '../../src/scenarios/controls';
const PIN='a'.repeat(40),OTHER='b'.repeat(40);
const box=(o:Partial<Parameters<typeof runtimePopover>[0]>={})=>runtimePopover({open:true,target:{base:'/lab/v2',kind:'same_origin'},draftUrl:'',paired:false,busy:false,health:null,pin:{expected:PIN,actual:null},error:null,...o});
const radio=(html:string,value:string)=>new RegExp(`<input[^>]*name="twin-runtime-where"[^>]*value="${value}"[^>]*>`).exec(html)?.[0]??'';
const health=(o:Partial<TwinHealth>={}):TwinHealth=>({sourceCommit:PIN,schemaHash:'s',protocolMajors:[2],scenarioIds:['MJ-BV01'],capabilities:[],backends:[],backendSets:[],...o});

test('this page\'s runtime: "Máy này" is chosen; the address field, the code field and the pinned commit are there',()=>{
 const html=box();
 expect(html).toContain('data-testid="runtime-popover"');
 expect(radio(html,'here')).toContain('checked');expect(radio(html,'other')).not.toContain('checked');
 expect(html).toContain('Máy này|このマシン|This machine');expect(html).toContain('Địa chỉ khác|別のアドレス|Another address');
 expect(html).toMatch(/<form id="twin-pair-form"[^]*<input id="twin-runtime-url"[^]*<input id="twin-pair-token"/);
 expect(html).toContain(PIN.slice(0,7));
 // the same machine's launcher runtime typed out is still "this machine"; any other address is "another address"
 expect(radio(box({draftUrl:'http://127.0.0.1:4176'}),'here')).toContain('checked');
 expect(radio(box({draftUrl:'https://rt.example',target:{base:'https://rt.example/lab/v2',kind:'remote'}}),'other')).toContain('checked');
 expect(box({open:false})).toMatch(/data-testid="runtime-popover" hidden/);
});

test('a runtime whose commit is not the pin: both commits are shown and the box says runs are blocked',()=>{
 const html=box({health:health({sourceCommit:OTHER}),pin:{expected:PIN,actual:OTHER}});
 const m=/data-testid="runtime-pin-mismatch"[^]*?<\/p>/.exec(html)?.[0]??'';
 expect(m).toContain(PIN.slice(0,7));expect(m).toContain(OTHER.slice(0,7));expect(m).toContain('RUNTIME_PIN_MISMATCH');
 expect(box({health:health(),pin:{expected:PIN,actual:PIN}})).not.toContain('runtime-pin-mismatch');
 expect(box({pin:{expected:PIN,actual:null}})).not.toContain('runtime-pin-mismatch');// nothing reached yet: nothing to compare
});

test('a pin mismatch disables every run button of the page; a matching runtime does not',()=>{
 const rt={paired:true,target:{base:'http://127.0.0.1:4176/lab/v2',kind:'loopback'},health:async()=>({}),pair:async()=>{},forget(){},get:async()=>{throw new Error('x');},report:async()=>{throw new Error('x');},create:async()=>{throw new Error('x');},action:async()=>{throw new Error('x');}} as unknown as TwinRuntime;
 const runs=(actual:string)=>{const w=new TwinWorkspace(()=>{},rt);Object.assign(w,{health:health({sourceCommit:actual,features:{readiness:false}}),healthChecked:true,pinExpected:PIN});
  const html=w.html();w.leave();return {html,buttons:[...html.matchAll(/<button[^>]*data-action="twin-run"[^>]*>/g)].map(m=>m[0])};};
 const bad=runs(OTHER);
 expect(bad.buttons.length).toBeGreaterThan(0);for(const b of bad.buttons)expect(b).toContain('disabled');
 expect(bad.html).toContain('RUNTIME_PIN_MISMATCH');
 const good=runs(PIN);expect(good.buttons.some(b=>!b.includes('disabled'))).toBe(true);
});

test('connection errors say what to do, in three languages',()=>{
 expect(box({error:'LOOPBACK_BLOCKED'})).toContain('Trình duyệt chặn kết nối tới 127.0.0.1 từ trang này. Dùng Chrome, Edge hoặc Firefox và cho phép khi được hỏi, hoặc chạy <code>pnpm lab:mujoco</code> rồi mở http://127.0.0.1:4175.|');
 expect(box({error:'LOOPBACK_BLOCKED'})).toMatch(/\|[^|]*127\.0\.0\.1[^|]*\|The browser blocked the connection to 127\.0\.0\.1 from this page\./);
 expect(box({error:'PAIRING_RATE_LIMITED'})).toMatch(/PAIRING_RATE_LIMITED[^]*một phút[^|]*\|[^|]*1分[^|]*\|[^|]*a minute/);
 // a page with no runtime of its own (not on this machine's loopback): the help points to the address field, never to "start a runtime here"
 const none=box({error:'NO_RUNTIME_ON_THIS_PAGE'});
 expect(none).toMatch(/twin-runtime-url/);expect(none).toContain('http://127.0.0.1:4176');expect(none).not.toContain('máy phát triển');
 expect(box({error:'SOMETHING_NEW'})).toContain('SOMETHING_NEW');// an unknown code is shown as it is
});

test('paired with a runtime on another origin: no code field; Connect (when not reached yet) and Disconnect',()=>{
 const t={base:'http://127.0.0.1:4176/lab/v2',kind:'loopback'} as const;
 const html=box({paired:true,target:t,draftUrl:'http://127.0.0.1:4176'});
 expect(html).not.toContain('twin-pair-token');expect(html).toContain('data-testid="runtime-address"');expect(html).toContain('data-action="twin-connect"');expect(html).toContain('data-action="twin-disconnect"');
 expect(box({paired:true,target:t,health:health()})).not.toContain('data-action="twin-connect"');
 expect(box({paired:true,target:t,busy:true})).toMatch(/data-action="twin-connect"[^>]*disabled/);
});

test('the MuJoCo set is offered only with its capability: without sim3d_arm_contact_v1 it is listed, not selectable, with the reason',()=>{
 const live=(id:string)=>({id,modes:['simulation'],installed:true,compatible:true,reachable:true,commissioned:true,enabled:true});
 const set={id:MUJOCO_ARM_SET,mode:'simulation',access:'simulated',backends:['mock_amr','mock_coffee','mujoco_arm'],execution:{host:'portable_python' as const,clock:'source_fixed_step' as const,manualStep:true,speedMultipliers:[1,4,16,64]}};
 const h=health({backends:['mock_amr','mock_coffee','mujoco_arm'].map(live),backendSets:[set]});
 expect(backendSetOptions(h).find(s=>s.id===MUJOCO_ARM_SET)).toEqual({id:MUJOCO_ARM_SET,mode:'simulation',selectable:false,reasons:['CAPABILITY_MISSING:sim3d_arm_contact_v1']});
 expect(backendSetOptions({...h,capabilities:['sim3d_arm_contact_v1']}).find(s=>s.id===MUJOCO_ARM_SET)).toMatchObject({selectable:true,reasons:[]});
});

test('the mujoco-coffee preset: MJ-BV01, seed 42, the MuJoCo set and the xArm 6 cell project, starting at 1×',()=>{
 const p=presetById('mujoco-coffee')!;
 expect(p.backendSetId).toBe(MUJOCO_ARM_SET);expect(MUJOCO_ARM_SET).toBe('engineering-mujoco-arm-v1');
 expect(p).toMatchObject({scenarioId:'MJ-BV01',seed:42,mode:'simulation',speed:1});
 expect(p.project.id).toBe('coffee-cell-xarm6');expect(p.project.armCollisionProfile).toBeTruthy();
 expect(p.engineering).toBeUndefined();// the runtime builds the cell from this project: no bundle
});

test('the preset\'s speed is applied when it is chosen; a later choice of the user stands, and other presets keep the current speed',()=>{
 const rt={paired:false,health:async()=>({}),pair:async()=>{},forget(){}} as unknown as TwinRuntime;
 const w=new TwinWorkspace(()=>{},rt),speed=()=>(w as unknown as {runSpeed:number}).runSpeed;
 expect(speed()).toBe(16);
 w.click('twin-preset','delivery');expect(speed()).toBe(16);
 w.click('twin-preset','mujoco-coffee');expect(speed()).toBe(1);
 w.change('twin-run-speed','16');expect(speed()).toBe(16);
 w.click('twin-preset','coffee');expect(speed()).toBe(16);
 w.leave();
});
