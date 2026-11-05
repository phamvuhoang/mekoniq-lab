// Twin workspace e2e against a REAL source runtime: export an artifact from the clean source checkout into a temp dir, then for each spec
// start it on 4176 with a fresh journal, hand Playwright the one-use pairing token, and stop it. Does not touch the S01 pin or .runtime/.
// Usage: node scripts/test-twin-e2e.mjs [--evidence] [spec ...]   (MEKONIQ_SOURCE_DIR overrides ../source)
import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from './runtime-artifact.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=resolve(process.env.MEKONIQ_SOURCE_DIR??join(root,'../source'));
if(Number(process.versions.node.split('.')[0])!==24)throw new Error('Node.js 24 required.');
const args=process.argv.slice(2),evidence=args.includes('--evidence');
const specs=args.filter(a=>!a.startsWith('--'));
const free=port=>new Promise((ok,fail)=>{const probe=createServer();probe.once('error',()=>fail(new Error(`Port ${port} is in use. Stop your development runtime before this test.`)));probe.listen(port,'127.0.0.1',()=>probe.close(ok));});
// Never stop a developer's running runtime to make a test pass.
await free(4176);
const work=await mkdtemp(join(tmpdir(),'mekoniq-twin-e2e-'));
let runtime,runner;
const stop=()=>{runner?.kill('SIGTERM');runtime?.kill('SIGTERM');};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 // export-lab-runtime refuses a dirty source tree; we never pass --allow-dirty
 execFileSync(process.execPath,[join(source,'scripts/export-lab-runtime.mjs'),join(work,'artifact')],{cwd:source,stdio:['ignore','ignore','inherit']});
 const manifest=JSON.parse(await readFile(join(work,'artifact/manifest.json'),'utf8')),file=join(work,'artifact/runtime.mjs');
 if(manifest.dirty!==false||digest(await readFile(file))!==manifest.artifactSha256)throw new Error('ARTIFACT_NOT_CLEAN_OR_HASH_MISMATCH');
 console.log(`Source runtime ${manifest.sourceCommit} (protocol ${manifest.protocolMajors?.join('/')}) artifact ${manifest.artifactSha256.slice(0,12)}`);
 const env={...process.env};
 if(evidence){env.LAB_EVIDENCE_DIR=join(root,'docs/implementation/evidence/digital-twin-v2');await mkdir(env.LAB_EVIDENCE_DIR,{recursive:true});}
 for(const spec of specs.length?specs:['twin-workspace.spec.ts','coffee-journey.spec.ts']){
  const data=join(work,`data-${spec}`);
  runtime=spawn(process.execPath,[file,'--port','4176','--data-dir',data],{cwd:work,stdio:['ignore','pipe','inherit']});
  const closed=new Promise(r=>runtime.once('close',r));
  const token=await new Promise((ok,fail)=>{
   let out='';const t=setTimeout(()=>fail(new Error('Runtime did not become ready.')),15000);
   runtime.once('exit',code=>{clearTimeout(t);fail(new Error(`Runtime exited before pairing: ${code}`));});
   runtime.stdout.on('data',c=>{out+=c;const m=/Pairing token \(expires in 5 minutes; one use\): (\S+)/.exec(out);if(m){clearTimeout(t);ok(m[1]);}});
  });
  console.log(`Running ${spec} against the exported runtime with a fresh journal.`);
  runner=spawn('pnpm',['exec','playwright','test',spec],{cwd:root,stdio:'inherit',env:{...env,LAB_TEST_PAIRING_TOKEN:token}});
  const code=await new Promise((ok,fail)=>{runner.once('error',fail);runner.once('exit',c=>ok(c??1));});
  runtime.kill('SIGTERM');await closed;runtime=undefined;
  if(code){process.exitCode=code;break;}
 }
}finally{
 stop();
 await rm(work,{recursive:true,force:true});
 process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
}
