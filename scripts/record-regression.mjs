#!/usr/bin/env node
// Records an evidence regression run for docs/implementation/evidence/digital-twin-v2/regression/: every command with start/finish time, exit code and a
// log; vitest/Playwright/pytest results as machine-readable files; absolute paths and credential-shaped strings scrubbed; sha256 of every stored file
// in manifest.json (schema lab-v2-regression/1). The acceptance guard (source tests/acceptance/lab-v2-mock.acceptance.test.ts) reads this manifest.
// Usage (Node 24, from lab/): node scripts/record-regression.mjs [--ci]
//   default: the Lab/source suites the R-MOCK coverage table references (no Supabase needed)
//   --ci:    adds the source CI-equivalent gate (build, unit, contracts, adapters, the full integration suite, pytest); the integration suite
//            needs the repo's local Supabase already running (`pnpm supabase:start` in source). This script never starts or stops services.
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import os from 'node:os';
const LAB=resolve(fileURLToPath(new URL('..',import.meta.url))),W=resolve(LAB,'..'),SRC=resolve(W,'source'),OUT=resolve(LAB,'docs/implementation/evidence/digital-twin-v2/regression');
const ci=process.argv.includes('--ci');
rmSync(OUT,{recursive:true,force:true});mkdirSync(OUT,{recursive:true});
const env={...process.env,LAB_V2_REQUIRE_LAB_FIXTURES:'1'};
const sha=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
// paths and anything shaped like a key/token are removed before a file is stored or hashed
const scrub=t=>t.replaceAll(process.execPath,'node').replaceAll(W,'<workspace>').replaceAll(os.homedir(),'<home>')
 .replace(/\/(private\/)?var\/folders\/[^"\s)]*/g,'<tmp>').replace(/\/private\/tmp\/[^"\s)]*/g,'<tmp>').replace(/(?<![\w<])\/tmp\/[^"\s)]*/g,'<tmp>')
 .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,'<jwt>').replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g,'<supabase-key>');
const runs=[],commands=[],notRun=[];
function summarize(kind,text){
 if(kind==='junit'){const m=/<testsuite[^>]*\btests="(\d+)"[^>]*\bfailures="(\d+)"|<testsuite[^>]*\bfailures="(\d+)"[^>]*\btests="(\d+)"/.exec(text),e=/\berrors="(\d+)"/.exec(text),s=/\bskipped="(\d+)"/.exec(text);
  return {tests:Number(m?.[1]??m?.[4]),failures:Number(m?.[2]??m?.[3]),errors:Number(e?.[1]??0),skipped:Number(s?.[1]??0)};}
 const j=JSON.parse(text);
 if(kind==='measurement')return {durationMs:j.durationMs,minimumDurationMet:j.minimumDurationMet,profiles:j.results.map(p=>({id:p.id,p95Ms:p.frameIntervals.p95Ms,paintP95Ms:p.workspacePaint.p95Ms,meetsTarget:p.meetsTarget}))};
 return kind==='vitest'?{passed:j.numPassedTests,failed:j.numFailedTests,skipped:j.numPendingTests+(j.numTodoTests??0),total:j.numTotalTests}:{expected:j.stats.expected,unexpected:j.stats.unexpected,skipped:j.stats.skipped,flaky:j.stats.flaky};
}
function run(id,repo,cmd,args,{kind=null,files=[],extraEnv={}}={}){
 const cwd=repo==='source'?SRC:LAB,startedAt=new Date().toISOString(),r=spawnSync(cmd,args,{cwd,env:{...env,...extraEnv},encoding:'utf8',maxBuffer:1<<28}),finishedAt=new Date().toISOString();
 const log=`${id}.log`;writeFileSync(`${OUT}/${log}`,scrub((r.stdout??'')+(r.stderr??'')));
 const command=scrub(`${Object.entries(extraEnv).map(([k,v])=>`${k}=${v}`).join(' ')} ${cmd} ${args.join(' ')}`.trim());
 commands.push({id,repo,command,startedAt,finishedAt,exitCode:r.status,log,logSha256:sha(`${OUT}/${log}`)});
 for(const f of files){
  if(!existsSync(`${OUT}/${f}`)){notRun.push({id:`${id}:${f}`,reason:`result file not produced (exit ${r.status})`});continue;}
  const text=scrub(readFileSync(`${OUT}/${f}`,'utf8'));writeFileSync(`${OUT}/${f}`,text);
  runs.push({id:`${id}:${f}`,repo,kind,command,startedAt,finishedAt,exitCode:r.status,file:f,sha256:sha(`${OUT}/${f}`),summary:summarize(kind,text)});
 }
 console.log(id,'exit',r.status);
}
const V='node_modules/vitest/vitest.mjs',out=f=>`--outputFile=${OUT}/${f}`;
const referenced=['lab-v2-mock','lab-v2-recovery','lab-v2-contracts','lab-v2-model','lab-v2-arm-model','lab-v2-stream','lab-v2-report','lab-v2-residuals','lab-runtime','lab-runtime-gateway','lab-runtime-contracts','lab-runtime-artifact','coffee-job','coffee-transfer','coffee-recovery','coffee-review','coffee-policy','coffee-conservation','lab-v2-runtime-review','lab-v2-software-gaps','lab-v2-mixed','lab-v2-arm-safety-model','lab-v2-arm-faults','lab-v2-arm-scene','lab-v2-arm-inactive-scene','lab-v2-checkpoint-compat','lab-v2-reclaim-targets','robot-admission','table-order-amendments'].map(f=>`tests/integration/${f}.test.ts`);
run('source-typecheck','source','pnpm',['-s','typecheck']);
run('source-lint','source','pnpm',['-s','lint']);
run('source-contracts-check','source','pnpm',['-s','contracts:check']);
run('source-referenced','source',process.execPath,[V,'run',...referenced,'--reporter=json',out('source-referenced.json')],{kind:'vitest',files:['source-referenced.json'],extraEnv:{LAB_V2_CLEAN_EXPORT:'1'}});
run('source-unit','source',process.execPath,[V,'run','tests/unit','--reporter=json',out('source-unit.json')],{kind:'vitest',files:['source-unit.json']});
run('source-contracts','source',process.execPath,[V,'run','tests/contracts','--reporter=json',out('source-contracts.json')],{kind:'vitest',files:['source-contracts.json']});
if(ci){
 run('source-build','source','pnpm',['-s','build']);
 run('source-adapters','source',process.execPath,[V,'run','tests/adapters','--reporter=json',out('source-adapters.json')],{kind:'vitest',files:['source-adapters.json']});
 run('source-integration','source',process.execPath,[V,'run','tests/integration','--reporter=json',out('source-integration.json')],{kind:'vitest',files:['source-integration.json']});
 if(existsSync(`${SRC}/.venv/bin/python`))run('source-pytest','source',`${SRC}/.venv/bin/python`,['-m','pytest','robotics/agent/tests','tests/hardware','tests/contracts/test_schema_python.py','-q',`--junitxml=${OUT}/source-pytest.xml`],{kind:'junit',files:['source-pytest.xml']});
 else notRun.push({id:'source-pytest',reason:'source/.venv missing (python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt)'});
}
run('lab-check-source','lab','pnpm',['-s','check:source']);
run('lab-typecheck','lab','pnpm',['-s','typecheck']);
run('lab-vitest','lab',`${LAB}/node_modules/.bin/vitest`,['run','tests/unit','tests/integration','--reporter=json',out('lab-vitest.json')],{kind:'vitest',files:['lab-vitest.json']});
run('lab-build','lab','pnpm',['-s','build']);
run('lab-e2e-ui','lab','pnpm',['-s','test:e2e','--','ui.spec.ts'],{kind:'playwright',files:['lab-pw-ui.json'],extraEnv:{LAB_PW_JSON:`${OUT}/lab-pw-ui.json`}});
run('lab-twin-e2e','lab','pnpm',['-s','test:twin-e2e','--evidence'],{kind:'playwright',files:['lab-pw-twin-twin-workspace.json','lab-pw-twin-coffee-journey.json','lab-pw-twin-twin-recovery.json'],extraEnv:{LAB_PW_JSON:`${OUT}/lab-pw-twin.json`}});
run('lab-mock-e2e','lab','pnpm',['-s','test:mock-e2e'],{kind:'playwright',files:['lab-pw-mock-twin-recovery.json','lab-pw-mock-coffee-journey.json'],extraEnv:{LAB_PW_JSON:`${OUT}/lab-pw-mock.json`}});
run('lab-runtime-e2e','lab','pnpm',['-s','test:runtime-e2e'],{kind:'playwright',files:['lab-pw-runtime.json'],extraEnv:{LAB_PW_JSON:`${OUT}/lab-pw-runtime.json`}});
run('lab-plan01-e2e','lab',process.execPath,['scripts/test-mock-e2e.mjs','--evidence','twin-plan01.spec.ts','twin-inputs.spec.ts'],{kind:'playwright',files:['lab-pw-plan01-twin-plan01.json','lab-pw-plan01-twin-inputs.json'],extraEnv:{LAB_PW_JSON:`${OUT}/lab-pw-plan01.json`}});
run('lab-ui-performance','lab',process.execPath,['scripts/measure-twin-ui.mjs','--duration-ms','60000','--output',`${OUT}/lab-ui-performance.json`],{kind:'measurement',files:['lab-ui-performance.json']});
const offline=mkdtempSync(resolve(os.tmpdir(),'mekoniq-offline-regression-')),bundle=resolve(offline,'bundle');
try{
 run('lab-offline-build','lab',process.execPath,['scripts/build-offline.mjs','--out',bundle]);
 run('lab-offline-e2e','lab',process.execPath,['scripts/test-mock-e2e.mjs','twin-recovery.spec.ts','coffee-journey.spec.ts'],{kind:'playwright',files:['lab-pw-offline-twin-recovery.json','lab-pw-offline-coffee-journey.json'],extraEnv:{LAB_TEST_OFFLINE_ROOT:bundle,LAB_PW_JSON:`${OUT}/lab-pw-offline.json`}});
}finally{rmSync(offline,{recursive:true,force:true});}
const git=(d,a)=>execFileSync('git',['-C',d,...a]).toString().trim();
writeFileSync(`${OUT}/manifest.json`,JSON.stringify({schema:'lab-v2-regression/1',recorder:'lab/scripts/record-regression.mjs'+(ci?' --ci':''),
 note:'Synthetic test data only; absolute paths scrubbed to <workspace>/<home>/<tmp>, key/token shapes to <jwt>/<supabase-key>. sha256 is of the stored (scrubbed) file.',
 host:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,cpus:os.cpus().length,memGiB:Math.round(os.totalmem()/2**30),node:process.version,pnpm:execFileSync('pnpm',['-v']).toString().trim()},
 revisions:{source:git(SRC,['rev-parse','HEAD']),sourceDirty:git(SRC,['status','--porcelain'])!=='',lab:git(LAB,['rev-parse','HEAD']),labDirty:git(LAB,['status','--porcelain','--','.',':!docs/implementation/evidence'])!==''},
 runs,commands,notRun},null,1)+'\n');
const failed=commands.filter(c=>c.exitCode!==0);
console.log(JSON.stringify({results:runs.map(r=>[r.id,r.summary]),failed:failed.map(c=>c.id),notRun}));
process.exitCode=failed.length||notRun.length?1:0;
