#!/usr/bin/env node
// Copies the generated engineering contract types from the sibling source checkout (one definition, never hand-edited here) and records where they came from.
//   node scripts/sync-engineering-contracts.mjs [--check]
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=(p)=>fileURLToPath(new URL(p,import.meta.url));
const sourceRoot=here('../../source/'),target=here('../src/shared/engineering.ts');
const generated=await readFile(here('../../source/packages/contracts/generated/engineering.ts'),'utf8');
// Lab owns its LabProjectV2/AssetRevision copies (shared/types); CoffeeRecipe is only carried through, never inspected here.
const body=generated.replace("import type { LabProjectV2, AssetRevision, CoffeeRecipe } from './lab-v2';","import type {LabProjectV2,AssetRevision} from './types';\nexport type CoffeeRecipe=Record<string,unknown>;");
if(body===generated)throw new Error('GENERATED_IMPORT_CHANGED');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim();
const dirty=execFileSync('git',['status','--porcelain','--','packages/contracts'],{cwd:sourceRoot,encoding:'utf8'}).trim();
if(dirty)throw new Error('SOURCE_CONTRACTS_DIRTY: commit source before syncing');
const header=`// Synced from source packages/contracts/generated/engineering.ts @ ${commit} (sha256 ${createHash('sha256').update(generated).digest('hex')}). Run node scripts/sync-engineering-contracts.mjs; do not edit.\n`;
const output=header+body;
// Schemas the browser validates archives with (runtimeProject stays Lab's own validator; assets and recipes are validated against their full source schemas).
const SCHEMAS=['engineering-component','engineering-project','engineering-bundle','engineering-project-archive','engineering-candidate','asset-revision','coffee-recipe','robot-physical-model-v1','model-validation-report-v1','navigation-run-evidence-v1'];
// Navigation/validation types (IR-SIM 2D, LinkForge shadow) come from the same generator; their './engineering' import resolves to shared/engineering.ts here too.
const navigationGenerated=await readFile(here('../../source/packages/contracts/generated/navigation2d.ts'),'utf8'),navigationTarget=here('../src/shared/navigation2d.ts');
if(!navigationGenerated.includes("from './engineering';"))throw new Error('GENERATED_IMPORT_CHANGED');
const navigationOutput=`// Synced from source packages/contracts/generated/navigation2d.ts @ ${commit} (sha256 ${createHash('sha256').update(navigationGenerated).digest('hex')}). Run node scripts/sync-engineering-contracts.mjs; do not edit.\n`+navigationGenerated;
// The Serve demo fixture (portable IR-SIM profile) the Assembly page opens: copied byte for byte after its own manifest hashes verify.
const fixtureSource=here('../../source/robotics/navigation-2d/fixtures/serve-demo-v1/'),fixtureTarget=here('../fixtures/engineering/serve-demo-v1/'),FIXTURE_FILES=['manifest.json','serve-project.json','serve-fleet-project.json','serve-components.json','navigation-scene.json'];
const fixtureManifest=JSON.parse(await readFile(`${fixtureSource}manifest.json`,'utf8'));
const fixtureFiles=await Promise.all(FIXTURE_FILES.map(async(n)=>{const b=await readFile(`${fixtureSource}${n}`);if(n!=='manifest.json'&&fixtureManifest.files.find(f=>f.path===n)?.sha256!==createHash('sha256').update(b).digest('hex'))throw new Error(`SERVE_FIXTURE_HASH_MISMATCH:${n}`);return [n,b];}));
if(execFileSync('git',['status','--porcelain','--','robotics/navigation-2d/fixtures'],{cwd:sourceRoot,encoding:'utf8'}).trim())throw new Error('SOURCE_FIXTURES_DIRTY: commit source before syncing');
const schemaDir=here('../src/shared/engineering-schemas/');
const schemaFiles=await Promise.all(SCHEMAS.map(async(n)=>[n,await readFile(here(`../../source/packages/contracts/schemas/${n}.schema.json`),'utf8')]));
if(process.argv.includes('--check')){
 const actual=await readFile(target,'utf8').catch(()=>'');
 // the commit in the header may lag unrelated source commits; only the content hash must match
 const strip=(s)=>s.replace(/^\/\/ Synced from .*\n/,'');
 if(strip(actual)!==strip(output)||actual.match(/sha256 ([0-9a-f]{64})/)?.[1]!==createHash('sha256').update(generated).digest('hex'))throw new Error('ENGINEERING_CONTRACTS_DRIFT: run node scripts/sync-engineering-contracts.mjs');
 for(const [n,text] of schemaFiles)if(await readFile(`${schemaDir}${n}.schema.json`,'utf8').catch(()=>'')!==text)throw new Error(`ENGINEERING_SCHEMA_DRIFT:${n}`);
 if(strip(await readFile(navigationTarget,'utf8').catch(()=>''))!==strip(navigationOutput))throw new Error('NAVIGATION_CONTRACTS_DRIFT: run node scripts/sync-engineering-contracts.mjs');
 for(const [n,b] of fixtureFiles)if(!b.equals(await readFile(`${fixtureTarget}${n}`).catch(()=>Buffer.alloc(0))))throw new Error(`SERVE_FIXTURE_DRIFT:${n}`);
 console.log('Engineering contracts match source.');
}else{await mkdir(schemaDir,{recursive:true});await mkdir(fixtureTarget,{recursive:true});for(const [n,text] of schemaFiles)await writeFile(`${schemaDir}${n}.schema.json`,text);for(const [n,b] of fixtureFiles)await writeFile(`${fixtureTarget}${n}`,b);await writeFile(target,output);await writeFile(navigationTarget,navigationOutput);console.log(`Wrote ${target}, ${navigationTarget} and the Serve fixture`);}
