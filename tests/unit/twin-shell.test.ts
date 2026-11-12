import {afterEach,expect,test,vi} from 'vitest';
vi.mock('../../src/i18n',()=>({tr:(vi:string)=>vi}));
import {runBar,type RunBarState} from '../../src/ui/run-bar';
import {transportBar,type TransportState} from '../../src/ui/transport';
import {inspector,loadUi,saveUi,type TwinUiState} from '../../src/ui/inspector';
// U01 shell: run bar (level 1), transport bar (one for run and replay), details inspector (level 2, closed by default, four named tabs).
const bar=(o:Partial<RunBarState>={}):RunBarState=>({scenarioTitle:'Cà phê sữa đá',runtime:{state:'live',label:'SSE',detail:''},mode:'Mô phỏng · MOCK',status:'Đang chạy',simTimeS:4.2,served:'1',problems:0,primary:null,inspectorOpen:false,...o});
const transport=(o:Partial<TransportState>={}):TransportState=>({mode:'live',playing:false,canPlay:true,canStep:true,canPause:true,paused:false,canCancel:true,speeds:[1,4,16,64],speed:4,simTimeS:4.2,tick:210,...o});
const ui=(o:Partial<TwinUiState>={}):TwinUiState=>({inspectorOpen:false,tab:'objects',watch:false,displayOpen:false,problemsOpen:false,runtimeOpen:false,pickerOpen:false,caveatOpen:false,...o});
const memory=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},m};};
afterEach(()=>vi.unstubAllGlobals());
test('the problem count shows only when there is a problem',()=>{
 expect(runBar(bar())).not.toContain('data-testid="problems-count"');
 expect(/data-testid="problems-count"[^>]*>([^]*?)<\/button>/.exec(runBar(bar({problems:2})))?.[1]).toContain('2');
 expect(/<button[^>]*data-testid="problems-count"[^>]*>/.exec(runBar(bar({problems:2})))?.[0]).toContain('data-action="twin-problems-toggle"');
});
test('the simulation label carries both an icon and text, and opens its explanation',()=>{
 const html=runBar(bar({mode:'Mô phỏng · MOCK'})),badge=/<button[^>]*data-testid="mode-badge"[^>]*>([^]*?)<\/button>/.exec(html)?.[1]??'';
 expect(badge).toContain('<svg');expect(badge).toContain('Mô phỏng · MOCK');
 expect(/<button[^>]*data-testid="mode-badge"[^>]*>/.exec(html)?.[0]).toContain('data-action="twin-caveat-toggle"');
});
test('idle transport disables every button; replay adds the cursor',()=>{
 const idle=transportBar(transport({mode:'idle',canPlay:false,canStep:false,canPause:false,canCancel:false}));
 const buttons=idle.match(/<button[^>]*>/g)??[];expect(buttons.length).toBeGreaterThan(0);
 for(const b of buttons)expect(b).toContain('disabled');
 expect(idle).not.toContain('twin-replay-cursor');
 expect(transportBar(transport({mode:'replay',replay:{fromTick:0,toTick:400,tick:100,playing:false,marks:[]}}))).toMatch(/<input[^>]*id="twin-replay-cursor"[^>]*type="range"|<input[^>]*type="range"[^>]*id="twin-replay-cursor"/);
});
test('replay: the transport carries play/stop, the marked scrubber, the recorded time and exit; no runtime action is enabled',()=>{
 const html=transportBar(transport({mode:'replay',replay:{fromTick:0,toTick:400,tick:100,playing:true,marks:[{tick:50,label:'job.started'}]}}));
 for(const a of ['twin-replay-play','twin-replay-exit'])expect(new RegExp(`<button[^>]*data-action="${a}"[^>]*>`).exec(html)?.[0],a).toMatch(/^<button(?![^>]*disabled)/);
 for(const a of ['twin-play','twin-stop','twin-cancel'])expect(html).not.toContain(`data-action="${a}"`);
 for(const a of ['twin-step','twin-pause'])expect(new RegExp(`<button[^>]*data-action="${a}"[^>]*disabled`).test(html),a).toBe(true);
 expect(html).toContain('Dừng phát');expect(html).toContain('list="twin-replay-marks"');expect(html).toContain('<option value="50" label="job.started">');
 expect(/data-testid="replay-time"[^>]*>([^<]*)</.exec(html)?.[1]).toBe('4.2 s · tick 210 / 400');
});
test('the measured speed shows only when it differs from the chosen speed by more than 10 %',()=>{
 expect(transportBar(transport({speed:4,measuredSpeed:3.9}))).not.toContain('measured-speed');
 expect(/data-testid="measured-speed"[^>]*>([^<]*)</.exec(transportBar(transport({speed:4,measuredSpeed:2.5})))?.[1]).toContain('2,5×');
});
test('a closed inspector is hidden and still holds all four tab panels',()=>{
 const html=inspector(ui(),{objects:'O',engineering:'E',report:'R',setup:'S'});
 expect(/<[^>]*data-testid="twin-inspector"[^>]*>/.exec(html)?.[0]).toMatch(/\shidden(\s|>|=)/);
 expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
 for(const t of ['objects','engineering','report','setup'])expect(html).toContain(`data-testid="inspector-tab-${t}"`);
 expect(/<[^>]*data-testid="twin-inspector"[^>]*>/.exec(inspector(ui({inspectorOpen:true}),{objects:'O',engineering:'E',report:'R',setup:'S'}))?.[0]).not.toMatch(/\shidden(\s|>|=)/);
});
test('loadUi falls back to the defaults on empty or broken storage; saveUi keeps only the inspector state',()=>{
 const s=memory();vi.stubGlobal('localStorage',s);
 expect(loadUi()).toMatchObject({inspectorOpen:false,tab:'objects',watch:false});
 s.m.set('mekoniq-lab-twin-ui','{not json');expect(loadUi()).toMatchObject({inspectorOpen:false,tab:'objects'});
 s.m.set('mekoniq-lab-twin-ui','{"inspectorOpen":"yes","tab":"nowhere"}');expect(loadUi()).toMatchObject({inspectorOpen:false,tab:'objects'});
 saveUi(ui({inspectorOpen:true,tab:'engineering',watch:true}));
 expect(loadUi()).toMatchObject({inspectorOpen:true,tab:'engineering',watch:false});
 vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}});
 expect(loadUi()).toMatchObject({inspectorOpen:false,tab:'objects'});expect(()=>saveUi(ui())).not.toThrow();
});
