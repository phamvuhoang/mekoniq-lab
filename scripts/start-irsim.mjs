#!/usr/bin/env node
// pnpm lab:irsim — the pinned source runtime with the portable IR-SIM 2D provider and LinkForge shadow validation switched on, plus the Lab UI, on loopback.
// Developer Mac/Linux only. It never downloads or installs anything, never falls back to the mock launcher, never stops a process it did not start.
// Before spawning it verifies: the pinned artifact carries portableSimulationTools; the source tool tree is exactly that closure; each worker venv is
// CPython 3.11 with every package of its lock installed at the locked version. Any failure exits 1 with a code; `pnpm lab:mock` is unaffected.
// Options: --source <dir> (default ../source) --irsim-python <path> (default <source>/.venv-irsim/bin/python) --linkforge-python <path>
// (default <source>/.venv-linkforge/bin/python), plus every lab:mock option (--ui-port 4175 --runtime-port 4176 --data-dir --root --boot-only).
// The source runtime accepts browser traffic only from 127.0.0.1:4175/4176, so other ports serve only non-browser checks.
import {execFile,spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,access,constants,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {launch,checkHealth,MOCK_BACKENDS} from './start-mock.mjs';
import {installedManifest,verifyPortableTree} from './runtime-artifact.mjs';
const run=promisify(execFile),lab=fileURLToPath(new URL('../',import.meta.url));
export const IRSIM_BACKEND='irsim_2d';
/** The runtime must be the pinned one with exactly the mock backends plus a live irsim_2d, and advertise both engineering and IR-SIM navigation. */
export function checkIRSimHealth(health,lock){
 const live=(health.backends??[]).find(b=>b.id===IRSIM_BACKEND);
 if(!live?.enabled||!live.installed||!live.compatible||!live.reachable)throw new Error(`IRSIM_PROVIDER_UNAVAILABLE:${live?.reason??'not offered'}`);
 for(const c of ['engineering_bundle_v1','irsim_navigation_v1'])if(!health.capabilities?.includes(c))throw new Error(`CAPABILITY_MISSING:${c}`);
 checkHealth({...health,backends:health.backends.filter(b=>b.id!==IRSIM_BACKEND)},lock);
}
// Reads the venv's installed distributions with the standard library only (isolated mode: no user site, no cwd on sys.path).
const PROBE="import sys,json,importlib.metadata as m\nprint(json.dumps({'version':list(sys.version_info[:2]),'impl':sys.implementation.name,'dists':{d.metadata['Name'].lower().replace('_','-'):d.version for d in m.distributions()}}))";
const pins=(text)=>[...text.matchAll(/^([A-Za-z0-9][A-Za-z0-9._-]*)==([^\s;\\]+)/gm)].map(([,n,v])=>[n.toLowerCase().replace(/[_.]/g,'-'),v]);
/** A preflight child in its own process group, handed to the launcher's `track` at spawn (so Ctrl-C stops it and whatever it started). */
// spawn, not execFile: execFile does not honour `detached`, so its child would share the launcher's group
const spawnProbe=(python,args,{timeout,env},track)=>new Promise((ok,fail)=>{
 const c=spawn(python,args,{env,detached:true,stdio:['ignore','pipe','ignore']});c.groupKill=true;track(c);let stdout='';
 const t=setTimeout(()=>{try{process.kill(-c.pid,'SIGKILL');}catch{/* gone */}},timeout);
 c.stdout.on('data',d=>{stdout+=d;});c.once('error',e=>{clearTimeout(t);fail(e);});
 c.once('close',(code)=>{clearTimeout(t);try{process.kill(-c.pid,'SIGKILL');}catch{/* the group is empty */}code===0?ok({stdout}):fail(new Error(`PROBE_EXIT:${code}`));});
});
/** CPython 3.11 whose installed distributions include every `name==version` of the lock. Returns null when it matches, else the reason code. */
export async function venvProblem(python,lockText,track=()=>{}){
 try{await access(python,constants.X_OK);if(!(await stat(python)).isFile())return 'PYTHON_MISSING';}catch{return 'PYTHON_MISSING';}
 let probe;try{probe=JSON.parse((await spawnProbe(python,['-I','-c',PROBE],{timeout:20000,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}},track)).stdout);}catch{return 'PYTHON_UNUSABLE';}
 if(probe.impl!=='cpython'||probe.version?.join('.')!=='3.11')return `PYTHON_UNSUPPORTED:${probe.impl}-${probe.version?.join('.')}`;
 const installed=Object.fromEntries(Object.entries(probe.dists??{}).map(([k,v])=>[k.replace(/[_.]/g,'-'),v]));
 const wrong=pins(lockText).filter(([n,v])=>installed[n]!==v).map(([n,v])=>`${n}==${v}${installed[n]?` (found ${installed[n]})`:' (missing)'}`);
 return wrong.length?`LOCK_MISMATCH:${wrong.slice(0,5).join(', ')}`:null;
}
export function irsimOptions(argv){
 const o={source:resolve(lab,'../source'),irsimPython:undefined,linkforgePython:undefined,rest:[]};
 const value=(i)=>{const v=argv[i];if(!v||v.startsWith('--'))throw new Error(`MISSING_VALUE:${argv[i-1]}`);return resolve(v);};
 for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a==='--source')o.source=value(++i);else if(a==='--irsim-python')o.irsimPython=value(++i);else if(a==='--linkforge-python')o.linkforgePython=value(++i);else o.rest.push(a);}
 o.irsimPython??=join(o.source,'.venv-irsim/bin/python');o.linkforgePython??=join(o.source,'.venv-linkforge/bin/python');
 return o;
}
/** Every check before a process is spawned; returns the runtime argv and env for the verified tools. */
export async function prepareIRSim(o,launch_,lock,track=()=>{}){
 const manifest=await installedManifest(launch_.root,lock),p=manifest.portableSimulationTools;
 if(!p)throw new Error('PORTABLE_TOOLS_NOT_IN_ARTIFACT: the pinned runtime predates portable simulation; import an export that carries portableSimulationTools.');
 const mismatch=await verifyPortableTree(p,o.source);
 if(mismatch.length)throw new Error(`PORTABLE_TOOLS_MISMATCH: ${mismatch.slice(0,5).join(', ')}${mismatch.length>5?` (+${mismatch.length-5})`:''}. The tools in ${o.source} are not the pinned closure ${p.closure.digest.slice(0,12)}.`);
 const tool=(id)=>p.tools.find(t=>t.id===id),root=(id)=>join(o.source,tool(id).root);
 for(const [id,python,code] of [['irsim_worker',o.irsimPython,'IRSIM'],['linkforge_worker',o.linkforgePython,'LINKFORGE']]){
  const problem=await venvProblem(python,await readFile(join(o.source,tool(id).lock.path),'utf8'),track);
  if(problem)throw new Error(`${code}_${problem}: ${python}. Provision it explicitly from ${tool(id).lock.path} (the launcher never installs).`);
 }
 // the server-owned component catalog of this launcher: the Serve fixture's components, taken from the verified closure
 const fixture=JSON.parse(await readFile(join(root('irsim_worker'),'fixtures/serve-demo-v1/serve-components.json'),'utf8')),catalog=join(launch_.dataDir,'irsim-catalog');
 for(const d of ['components','models','documents'])await mkdir(join(catalog,d),{recursive:true});
 const entries=[];
 for(const [digest,c] of Object.entries(fixture.components)){const file=`components/${digest}.json`;await writeFile(join(catalog,file),JSON.stringify(c));entries.push({file,digest});}
 for(const [digest,m] of Object.entries(fixture.models??{}))await writeFile(join(catalog,'models',`${digest}.json`),JSON.stringify(m));
 await writeFile(join(catalog,'catalog.json'),JSON.stringify({schemaVersion:1,id:'serve-demo-v1',components:entries,quotes:[]}));
 const simulation=join(o.source,tool('description_helper').root,'..');
 return {readyMs:60000,backends:[...MOCK_BACKENDS,IRSIM_BACKEND].join(', '),env:{MEKONIQ_LAB_IRSIM:'1',MEKONIQ_LAB_LINKFORGE:'1'},
  args:['--engineering-catalog',catalog,'--engineering-simulation',simulation,'--engineering-python',o.irsimPython,'--linkforge-python',o.linkforgePython,'--linkforge-worker',root('linkforge_worker'),
   '--irsim-python',o.irsimPython,'--irsim-worker',root('irsim_worker'),'--irsim-lock',join(o.source,tool('irsim_worker').lock.path)]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let o;try{o=irsimOptions(process.argv.slice(2));}catch(e){console.error(e.message);process.exit(1);}
 await launch({argv:o.rest,prepare:(l,lock,track)=>prepareIRSim(o,l,lock,track),check:checkIRSimHealth,banner:'Mekoniq Robot Lab — IR-SIM 2D twin (portable simulation; no robot hardware, not a native/Gazebo run)'});
}
