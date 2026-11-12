// Transport bar of the twin page: one bar for a live run and for replay. It only names runtime requests (auto-run, +5 s, pause/resume,
// cancel) and the view's run speed; the replay cursor never touches the runtime. Idle (no run) disables every button.
import {icon,esc} from './icons';
import {tr} from '../i18n';
export interface TransportState {mode:'idle'|'live'|'replay';playing:boolean;canPlay:boolean;canStep:boolean;canPause:boolean;paused:boolean;canCancel:boolean;speeds:number[];speed:number;simTimeS:number;tick:number;
 /** Tốc độ đo được khi đang tự chạy; hiện cạnh tốc độ chọn khi lệch quá 10 % (data-testid measured-speed). */measuredSpeed?:number;
 replay?:{fromTick:number;toTick:number;tick:number;playing:boolean;marks:{tick:number;label:string}[]}}
const btn=(label:string,action:string,ico:string,on:boolean,cls='secondary')=>`<button class="button ${cls}" data-action="${action}"${on?'':' disabled'}>${icon(ico,16)}<span>${label}</span></button>`;
/** 2.5 -> "2,5" in Vietnamese, "2.5" otherwise. */
const decimal=(n:number)=>{const s=n.toFixed(1);return tr(s.replace('.',','),s,s);};
export function transportBar(s:TransportState):string{
 const run=s.mode==='live',r=s.mode==='replay'?s.replay:undefined;
 const play=s.playing?btn(tr('Tạm dừng tự chạy','自動実行を停止','Stop auto-run'),'twin-stop','cross',run):btn(tr('Tự chạy','自動実行','Auto-run'),'twin-play','play',run&&s.canPlay);
 const pause=s.paused?btn(tr('Tiếp tục mô phỏng','シミュレーション再開','Resume simulation'),'twin-resume','play',run&&s.canPause):btn(tr('Tạm dừng mô phỏng','シミュレーション一時停止','Pause simulation'),'twin-pause','cross',run&&s.canPause);
 const measured=s.measuredSpeed!==undefined&&Math.abs(s.measuredSpeed-s.speed)>0.1*s.speed?`<span class="twin-measured" data-testid="measured-speed">${tr('đo được','実測','measured')} ${esc(decimal(s.measuredSpeed))}×</span>`:'';
 const cursor=r?`<label for="twin-replay-cursor" class="visually-hidden">${tr('Vị trí xem lại (tick)','再生位置(tick)','Replay position (tick)')}</label><input id="twin-replay-cursor" type="range" min="${esc(r.fromTick)}" max="${esc(r.toTick)}" step="5" value="${esc(r.tick)}"${r.marks.length?' list="twin-replay-marks"':''}>${r.marks.length?`<datalist id="twin-replay-marks">${r.marks.map(m=>`<option value="${esc(m.tick)}" label="${esc(m.label)}"></option>`).join('')}</datalist>`:''}`:'<span class="twin-transport-fill"></span>';
 return `<div class="twin-transport" id="twin-transport" data-testid="twin-transport" role="group" aria-label="${tr('Điều khiển lần chạy','実行の操作','Run controls')}">
${play}${btn('+5 s','twin-step','arrow',run&&s.canStep)}${pause}<label class="twin-speed"><span>${tr('Tốc độ chạy','実行速度','Run speed')}</span><select id="twin-run-speed">${s.speeds.map(n=>`<option value="${esc(n)}"${n===s.speed?' selected':''}>${esc(n)}×</option>`).join('')}</select></label>${measured}
${cursor}<span class="twin-transport-time" id="twin-transport-time">${esc(s.simTimeS.toFixed(1))} s · tick ${esc(s.tick)}</span>${btn(tr('Hủy lần chạy','実行をキャンセル','Cancel run'),'twin-cancel','cross',run&&s.canCancel,'quiet')}</div>`;
}
