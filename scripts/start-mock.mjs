#!/usr/bin/env node
// pnpm lab:mock — run the INSTALLED, pinned source runtime (mock backends only) and the Lab UI on loopback, in one terminal.
// Never downloads or installs anything, never starts a stand-in when the runtime is missing, never stops a process it did not start.
// Options (defaults are the only ones the source runtime accepts browser traffic from): --ui-port 4175 --runtime-port 4176 --data-dir <lab>/runs
// --root <dir> selects another Lab install (tests); --boot-only exits after ready (boot-to-ready measurement).
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedRuntime} from './runtime-artifact.mjs';
export const MOCK_BACKENDS=['mock_amr','mock_coffee','mock_arm'];
const FORBIDDEN_PORTS=[1880,1884];// operational Node-RED/MQTT on live robots
const lab=fileURLToPath(new URL('../',import.meta.url));
export function assertNode(version=process.versions.node){if(Number(version.split('.')[0])!==24)throw new Error(`UNSUPPORTED_NODE:${version}. Use Node.js 24 (see .node-version), then run pnpm lab:mock.`);}
export function assertPlatform(platform=process.platform){if(!['darwin','linux'].includes(platform))throw new Error(`UNSUPPORTED_OS:${platform}. The mock launcher supports macOS and Linux (Linux not yet verified on a fresh host).`);}
function assertPort(port){if(!Number.isInteger(port)||port<1024||port>65535)throw new Error(`INVALID_PORT:${port}`);if(FORBIDDEN_PORTS.includes(port))throw new Error(`FORBIDDEN_PORT:${port} is an operational robot port; the Lab never uses it.`);}
const portFree=(port)=>new Promise((ok,fail)=>{const s=createServer();s.once('error',()=>fail(new Error(`PORT_IN_USE:${port}. Another process holds it; stop that process yourself (the launcher never stops it) and retry.`)));s.listen(port,'127.0.0.1',()=>s.close(ok));});
/** The running runtime must be the pinned one, speak v2 and enable exactly the mock backends. */
export function checkHealth(health,lock){
 if(health.sourceCommit!==lock.sourceCommit||health.schemaHash!==lock.schemaHash)throw new Error('RUNTIME_IDENTITY_MISMATCH');
 if(!health.protocolMajors?.includes(2))throw new Error('RUNTIME_PROTOCOL_V2_REQUIRED');
 const enabled=new Set((health.backends??[]).filter(b=>b.enabled).map(b=>b.id));
 for(const id of MOCK_BACKENDS)if(!enabled.has(id))throw new Error(`BACKEND_UNAVAILABLE:${id}`);
 for(const id of enabled)if(!MOCK_BACKENDS.includes(id))throw new Error(`NON_MOCK_BACKEND_ENABLED:${id}`);
}
const PREVIEW='Runtime unavailable: the Lab can only open in preview only mode (design, layout, no runs or results). Install the pinned export with node scripts/import-runtime.mjs <artifact-dir> (see README), then pnpm check:source.';
function options(argv){
 const o={root:lab,uiPort:4175,runtimePort:4176,dataDir:undefined,bootOnly:false};
 for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a==='--')continue;else if(a==='--root')o.root=resolve(argv[++i]);else if(a==='--ui-port')o.uiPort=Number(argv[++i]);else if(a==='--runtime-port')o.runtimePort=Number(argv[++i]);
  else if(a==='--data-dir')o.dataDir=resolve(argv[++i]);else if(a==='--boot-only')o.bootOnly=true;else throw new Error(`UNKNOWN_ARGUMENT:${a}`);}
 o.dataDir??=join(o.root,'runs');return o;
}
const waitFor=(child,name,until,ms)=>new Promise((ok,fail)=>{
 const t=setTimeout(()=>{clearInterval(i);fail(new Error(`${name}_NOT_READY after ${ms} ms`));},ms),onExit=c=>{clearTimeout(t);clearInterval(i);fail(new Error(`${name}_EXITED:${c}`));};
 child.once('exit',onExit);
 const i=setInterval(async()=>{try{const v=await until();if(v!==undefined){clearTimeout(t);clearInterval(i);child.off('exit',onExit);ok(v);}}catch{/* not yet */}},100);
});
async function main(){
 const started=performance.now(),owned=[];
 let stopping;
 const stop=()=>stopping??=Promise.all(owned.filter(c=>c.exitCode===null&&c.signalCode===null).map(c=>new Promise(r=>{const k=setTimeout(()=>c.kill('SIGKILL'),5000);c.once('exit',()=>{clearTimeout(k);r();});c.kill('SIGTERM');})));
 for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{if(stopping)return;console.log('\nStopping the runtime and UI this launcher started…');void stop().then(()=>process.exit(0));});
 try{
  assertNode();assertPlatform();
  const o=options(process.argv.slice(2));
  assertPort(o.uiPort);assertPort(o.runtimePort);if(o.uiPort===o.runtimePort)throw new Error('INVALID_PORT:ui and runtime ports must differ');
  let runtime;
  try{runtime=await checkedRuntime(o.root);}catch(e){throw new Error(`${e.code==='ENOENT'?'RUNTIME_NOT_INSTALLED':e.message}. ${PREVIEW}`);}
  const {lock,file}=runtime;
  if(!(lock.protocolMajors??[lock.protocolMajor]).includes(2))throw new Error(`RUNTIME_PROTOCOL_V2_REQUIRED: pinned artifact offers protocol ${lock.protocolMajor} only. ${PREVIEW}`);
  const vite=join(lab,'node_modules/vite/bin/vite.js');
  await access(vite).catch(()=>{throw new Error('DEPENDENCIES_NOT_INSTALLED: run pnpm install --frozen-lockfile once (the launcher never downloads).');});
  await portFree(o.runtimePort);await portFree(o.uiPort);
  const rt=spawn(process.execPath,[file,'--port',String(o.runtimePort),'--data-dir',o.dataDir],{cwd:o.root,stdio:['ignore','pipe','inherit'],env:process.env});owned.push(rt);
  let out='';rt.stdout.on('data',c=>{out+=c;});
  const token=await waitFor(rt,'RUNTIME',()=>/Pairing token \(expires in 5 minutes; one use\): (\S+)/.exec(out)?.[1],15000);
  const health=await (await fetch(`http://127.0.0.1:${o.runtimePort}/lab/v2/health`)).json();
  checkHealth(health,lock);
  const ui=spawn(process.execPath,[vite,'--host','127.0.0.1','--port',String(o.uiPort),'--strictPort'],{cwd:lab,stdio:['ignore','ignore','inherit'],env:{...process.env,LAB_RUNTIME_PORT:String(o.runtimePort)}});owned.push(ui);
  await waitFor(ui,'UI',async()=>(await fetch(`http://127.0.0.1:${o.uiPort}/`)).ok||undefined,30000);
  console.log(`Mekoniq Robot Lab — mock twin (simulated; no robot hardware)
Source ${lock.sourceCommit} · artifact ${lock.artifactSha256.slice(0,12)} · protocol ${health.protocolMajors.join('/')}
Backends: ${MOCK_BACKENDS.join(', ')} · journal ${o.dataDir}
Owned processes: runtime pid ${rt.pid}, UI pid ${ui.pid}
Open http://127.0.0.1:${o.uiPort} and enter this one-use pairing code (expires in 5 minutes): ${token}
Ready in ${Math.round(performance.now()-started)} ms. Press Ctrl-C to stop.`);
  if(o.bootOnly){await stop();return;}
  const code=await new Promise(r=>{for(const c of owned)c.once('exit',x=>r(x));});
  if(!stopping){console.error(`A launcher process exited unexpectedly (${code}); stopping the other one.`);await stop();process.exitCode=1;}
 }catch(e){console.error(e.message);await stop();process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
