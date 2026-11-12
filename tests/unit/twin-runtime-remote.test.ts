import {afterEach,expect,test,vi} from 'vitest';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import type {AddressInfo} from 'node:net';
import {httpTwinRuntime,TwinRuntimeError,type RunView,type TwinRuntime} from '../../src/scenarios/controls';
import {openRunStreams,type LinkState} from '../../src/runtime/stream';
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const flush=()=>new Promise(r=>setTimeout(r,5));
/** A stand-in gateway on an ephemeral loopback port: bearer only (401 without it), pairing, health, a run and its two SSE streams. */
async function gateway(){
 const seen:{method:string;url:string;auth:string|undefined;csrf:string|undefined}[]=[];let eventsOpened=0;
 const sse=(res:ServerResponse)=>res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});
 const record=(seq:number)=>`id: ${seq}\nevent: business\ndata: ${JSON.stringify({sequence:String(seq),at:'t',events:[]})}\n\n`;
 const server=createServer((req:IncomingMessage,res:ServerResponse)=>{
  const url=new URL(req.url!,'http://x');seen.push({method:req.method!,url:req.url!,auth:req.headers.authorization,csrf:req.headers['x-csrf-token'] as string|undefined});
  const json=(status:number,body:unknown)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
  if(url.pathname==='/lab/v2/health')return json(200,{sourceCommit:'b'.repeat(40),schemaHash:'s',protocolMajors:[2],features:{bearer:true,pacedStep:true}});
  if(url.pathname==='/lab/v2/sessions'&&req.method==='POST')return json(201,{csrfToken:'csrf-1',sessionToken:'tok-1',principal:'p'});
  if(req.headers.authorization!=='Bearer tok-1')return json(401,{error:'SESSION_REQUIRED'});
  if(url.pathname==='/lab/v2/runs/r1')return json(200,{run:{id:'r1',runRevision:7}});
  if(url.pathname==='/lab/v2/runs/r1/actions')return json(200,{run:{id:'r1',runRevision:8}});
  if(url.pathname==='/lab/v2/runs/r1/telemetry'){sse(res);res.write(': open\n\n');return;}
  if(url.pathname==='/lab/v2/runs/r1/events'){
   sse(res);eventsOpened++;const after=Number(url.searchParams.get('after')??0);
   // first connection: records 1 and 2, then the server cuts the stream; the next connection resumes after the cursor
   if(eventsOpened===1){res.write(record(after+1));res.write(record(after+2));setTimeout(()=>res.end(),30);}
   else for(let s=after+1;s<=3;s++)res.write(record(s));
   return;
  }
  json(404,{error:'NOT_FOUND'});
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 const port=(server.address() as AddressInfo).port;
 return {seen,base:`http://127.0.0.1:${port}/lab/v2`,close:()=>new Promise<void>(r=>{server.closeAllConnections();server.close(()=>r());})};
}

test('a loopback target pairs once, then sends the bearer (never a CSRF header or a cookie) and forgets it on 401',async()=>{
 const g=await gateway();
 try{
  const rt=httpTwinRuntime({base:g.base,kind:'loopback'});
  expect(rt.target).toEqual({base:g.base,kind:'loopback'});expect(rt.paired).toBe(false);
  await rt.pair('one-use');expect(rt.paired).toBe(true);
  await rt.action({run:{id:'r1',runRevision:7}} as RunView,'step',{ticks:20,pace:{factor:4}},'a-1');
  const post=g.seen.find(s=>s.url.endsWith('/actions'))!;
  expect(post.auth).toBe('Bearer tok-1');expect(post.csrf).toBeUndefined();
  expect(g.seen.find(s=>s.url.endsWith('/sessions'))!.auth).toBeUndefined();
  // the token is the session: a runtime that no longer knows it (restart) answers 401 and the pairing form comes back
  rt.forget();expect(rt.paired).toBe(false);
  await expect(rt.get('r1')).rejects.toMatchObject({code:'SESSION_REQUIRED',status:401});
 }finally{await g.close();}
});

test('the bearer request carries no credentials and names the loopback address space',async()=>{
 const calls:RequestInit[]=[];
 vi.stubGlobal('fetch',vi.fn(async(_u:string,init:RequestInit)=>{calls.push(init);return new Response(JSON.stringify({csrfToken:'c',sessionToken:'t'}),{status:201});}));
 const rt=httpTwinRuntime({base:'http://127.0.0.1:4176/lab/v2',kind:'loopback'});await rt.pair('x');await rt.get('r1').catch(()=>null);
 expect(calls[1]).toMatchObject({credentials:'omit',targetAddressSpace:'loopback',headers:{Authorization:'Bearer t'}});
});

test('the same-origin default is unchanged: cookie credentials and the CSRF header',async()=>{
 const calls:[string,RequestInit][]=[];
 vi.stubGlobal('fetch',vi.fn(async(u:string,init:RequestInit)=>{calls.push([u,init]);return new Response(JSON.stringify({csrfToken:'c1',sessionToken:'t'}),{status:201});}));
 const rt=httpTwinRuntime();expect(rt.target).toEqual({base:'/lab/v2',kind:'same_origin'});
 await rt.pair('x');await rt.action({run:{id:'r1',runRevision:1}} as RunView,'start');
 expect(calls[1]![0]).toBe('/lab/v2/runs/r1/actions');
 expect(calls[1]![1]).toMatchObject({method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':'c1'}});
 expect(JSON.stringify(calls[1]![1].headers)).not.toContain('Authorization');
 expect(rt.streamDeps!().base).toBe('/lab/v2');
});

test('openRunStreams over FetchEventSource: connecting, live, a cut stream, live again from ?after=<cursor> without losing a business record',async()=>{
 const g=await gateway();
 try{
  const rt=httpTwinRuntime({base:g.base,kind:'loopback'});await rt.pair('one-use');
  const states:LinkState[]=[],business:string[]=[];
  const s=openRunStreams('r1','0',{onState:x=>states.push(x),onBusiness:e=>business.push(e.sequence)},{...rt.streamDeps!(),network:null});
  expect(s.state).toBe('connecting');
  await vi.waitFor(()=>expect(business).toEqual(['1','2','3']),{timeout:4000});
  await vi.waitFor(()=>expect(states.at(-1)).toBe('live'));
  expect(states[0]).toBe('live');expect(states.some(x=>x==='polling'||x==='reconnecting')).toBe(true);
  const opens=g.seen.filter(x=>x.url.includes('/events'));
  expect(opens.map(x=>x.url)).toEqual(['/lab/v2/runs/r1/events?after=0','/lab/v2/runs/r1/events?after=2']);
  // every stream request and the probe carry the bearer; none carries a token in its URL
  for(const x of g.seen.filter(x=>x.url.startsWith('/lab/v2/runs/')))expect(x.auth).toBe('Bearer tok-1');
  expect(g.seen.some(x=>x.url.includes('tok-1'))).toBe(false);
  s.close();
 }finally{await g.close();}
});

test('create refuses a runtime whose source commit differs from the Lab pin (other targets only)',async()=>{
 const urls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(u:string)=>{urls.push(u);
  if(u==='/source-runtime.lock.json')return new Response(JSON.stringify({sourceCommit:'a'.repeat(40)}));
  if(u.endsWith('/health'))return new Response(JSON.stringify({sourceCommit:'b'.repeat(40)}));
  return new Response(JSON.stringify({run:{id:'r1'}}),{status:201});}));
 const rt=httpTwinRuntime({base:'https://rt.example/lab/v2',kind:'remote'});
 const e=await rt.create({} as never,{sourceCommit:'b'.repeat(40),schemaHash:'s'}).catch(x=>x);
 expect(e).toBeInstanceOf(TwinRuntimeError);expect(e).toMatchObject({code:'RUNTIME_PIN_MISMATCH',reasonCodes:['bbbbbbb','aaaaaaa']});
 expect(urls.some(u=>u.endsWith('/runs'))).toBe(false);
 urls.length=0;await httpTwinRuntime().create({} as never,{sourceCommit:'b'.repeat(40),schemaHash:'s'});
 expect(urls).toEqual(['/lab/v2/runs']);// same origin: the launcher installed the pinned runtime, no pin request
});

test('a loopback fetch the browser refuses becomes LOOPBACK_BLOCKED; a remote one stays a network error',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Failed to fetch');}));
 await expect(httpTwinRuntime({base:'http://127.0.0.1:4176/lab/v2',kind:'loopback'}).health()).rejects.toMatchObject({code:'LOOPBACK_BLOCKED'});
 await expect(httpTwinRuntime({base:'https://rt.example/lab/v2',kind:'remote'}).health()).rejects.toBeInstanceOf(TypeError);
});

// The play loop of the workspace against a runtime that paces steps (features.pacedStep).
const docStub={getElementById:()=>null,activeElement:null,visibilityState:'visible' as 'visible'|'hidden',listeners:[] as (()=>void)[],
 addEventListener(t:string,f:()=>void){if(t==='visibilitychange')this.listeners.push(f);},removeEventListener(t:string,f:()=>void){this.listeners=this.listeners.filter(x=>x!==f);}};
async function loop(o:{conflictAt?:number;lostAt?:number;completeAt?:number;onSend?:(n:number)=>void}={}){
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});vi.stubGlobal('innerWidth',600);
 docStub.visibilityState='visible';docStub.listeners=[];vi.stubGlobal('document',docStub);
 const {TwinWorkspace}=await import('../../src/ui/workspace');
 let rev=3,inflight=0,maxInflight=0,gets=0;let tick=0;const receipts=new Map<string,RunView>();
 const sent:{expected:number;payload:Record<string,unknown>;actionId:string}[]=[];
 const viewAt=():RunView=>({run:{schemaVersion:2,id:'r1',mode:'mock',access:'simulated',backendSetId:'mock-default',backends:[],status:o.completeAt!==undefined&&tick>=o.completeAt*20?'completed':'running',runRevision:rev,eventCursor:null,telemetryCursor:null,fidelity:'modeled',ageMs:0,sourceCommit:'d',scenarioId:'BV01',scenarioRevision:1,seed:42},
  tick,simTimeNs:String(tick*20_000_000),model:'m',entities:[],workload:[],awaiting:[],attention:[],served:'0',coffee:null});
 const rt={paired:true,target:{base:'http://127.0.0.1:4176/lab/v2',kind:'loopback'},forget(){},health:async()=>({}),report:async()=>{throw new Error('none');},
  get:async()=>{gets++;return viewAt();},
  action:async(v:RunView,kind:string,payload:Record<string,unknown>={},actionId='')=>{
   inflight++;maxInflight=Math.max(maxInflight,inflight);await new Promise(r=>setTimeout(r,3));inflight--;
   sent.push({expected:v.run.runRevision,payload,actionId});const n=sent.length;o.onSend?.(n);
   const receipt=receipts.get(actionId);if(receipt)return receipt;// the runtime's idempotency: a known actionId returns its stored receipt
   // another tab steps with the same expectedRevision first: ours is the second and is refused
   if(n===o.conflictAt)rev++;
   if(v.run.runRevision!==rev)throw new TwinRuntimeError('REVISION_CONFLICT',[],409);
   expect(kind).toBe('step');rev++;tick+=Number(payload.ticks);const r=viewAt();receipts.set(actionId,r);
   if(n===o.lostAt)throw new TypeError('Failed to fetch');// the step ran; its response was lost
   return r;
  }} as unknown as TwinRuntime;
 const w=new TwinWorkspace(()=>{},rt);
 Object.assign(w,{health:{sourceCommit:'d',schemaHash:'s',protocolMajors:[2],scenarioIds:[],backends:[],backendSets:[],features:{pacedStep:true}},view:viewAt(),openStreams:()=>{}});
 const h=w as unknown as {playing:boolean;busy:boolean;notice:string;view:RunView;measuredSpeed:number|undefined};
 return {w,h,sent,stats:()=>({maxInflight,gets,rev})};
}

test('Review Focus: paced steps one at a time; a REVISION_CONFLICT re-reads the run and stops the loop',async()=>{
 const {w,h,sent,stats}=await loop({conflictAt:4});
 w.change('twin-run-speed','4');w.click('twin-play');
 await vi.waitFor(()=>expect(h.busy).toBe(false),{timeout:3000});
 expect(h.playing).toBe(false);expect(h.notice).toContain('REVISION_CONFLICT');
 expect(sent).toHaveLength(4);expect(stats().maxInflight).toBe(1);
 // each step carries the revision the previous one returned; the fourth reused it and lost to the other tab
 expect(sent.map(s=>s.expected)).toEqual([3,4,5,6]);
 for(const s of sent)expect(s.payload).toEqual({ticks:20,pace:{factor:4}});
 expect(new Set(sent.map(s=>s.actionId)).size).toBe(4);
 expect(stats().gets).toBe(1);expect(h.view.run.runRevision).toBe(stats().rev);// the workspace shows the runtime's run, not a guess
 await new Promise(r=>setTimeout(r,30));expect(sent).toHaveLength(4);
 w.leave();
});

test('a factor change applies to the next step; a lost response is resent once with the same actionId; a final run stops the loop',async()=>{
 // the speed changes while the second step is in flight (its response is then lost): the resend keeps its body, the next step takes 64×
 let ws!:{change(id:string,v:string):void};const {w,h,sent}=await loop({lostAt:2,completeAt:5,onSend:n=>{if(n===2)ws.change('twin-run-speed','64');}});ws=w;
 w.click('twin-play');
 await vi.waitFor(()=>expect(h.busy).toBe(false),{timeout:3000});
 expect(sent[1]!.actionId).toBe(sent[2]!.actionId);expect(sent[2]!.payload).toEqual({ticks:20,pace:{factor:16}});expect(sent[1]!.expected).toBe(sent[2]!.expected);
 expect(sent.slice(3).map(s=>s.payload)).toEqual([{ticks:20,pace:{factor:64}},{ticks:20,pace:{factor:64}},{ticks:20,pace:{factor:64}}]);
 expect(h.view.run.status).toBe('completed');expect(h.playing).toBe(false);expect(h.notice).toBe('');
 expect(h.measuredSpeed).toBeGreaterThan(0);
 const n=sent.length;await new Promise(r=>setTimeout(r,30));expect(sent).toHaveLength(n);
 w.leave();
});

test('a hidden tab stops sending after the in-flight step and resumes when visible unless the user stopped',async()=>{
 const {w,h,sent}=await loop();
 w.click('twin-play');await vi.waitFor(()=>expect(sent.length).toBeGreaterThanOrEqual(2));
 docStub.visibilityState='hidden';
 await vi.waitFor(()=>expect(h.busy).toBe(false));const n=sent.length;
 await new Promise(r=>setTimeout(r,30));expect(sent).toHaveLength(n);
 docStub.visibilityState='visible';for(const f of [...docStub.listeners])f();
 await vi.waitFor(()=>expect(sent.length).toBeGreaterThan(n+1));
 w.click('twin-stop');await vi.waitFor(()=>expect(h.busy).toBe(false));const m=sent.length;
 docStub.visibilityState='hidden';for(const f of [...docStub.listeners])f();docStub.visibilityState='visible';for(const f of [...docStub.listeners])f();
 await new Promise(r=>setTimeout(r,30));expect(sent).toHaveLength(m);
 w.leave();
});
