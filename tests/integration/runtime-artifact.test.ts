import {expect,test} from 'vitest';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
// @ts-expect-error CLI JavaScript boundary
import {installRuntime} from '../../scripts/runtime-artifact.mjs';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'lab-artifact-test-'));const from=join(dir,'export');const dest=join(dir,'lab');await mkdir(from);await mkdir(dest);const js='export const testArtifact = true;\n';const manifest={sourceCommit:'a'.repeat(40),schemaHash:'b'.repeat(64),protocolMajor:1,nodeMajor:24,entrypoint:'runtime.mjs',artifactSha256:digest(js)};await writeFile(join(from,'runtime.mjs'),js);await writeFile(join(from,'manifest.json'),JSON.stringify(manifest));return {dir,from,dest,js,manifest};}
test('installs only an integrity-checked runtime and pins identity',async()=>{const f=await fixture();try{await installRuntime(f.from,f.dest);expect(await readFile(join(f.dest,'.runtime',f.manifest.artifactSha256,'runtime.mjs'),'utf8')).toBe(f.js);expect(JSON.parse(await readFile(join(f.dest,'config/source-runtime.lock.json'),'utf8')).sourceCommit).toBe('a'.repeat(40));}finally{await rm(f.dir,{recursive:true,force:true});}});
test('tampered artifact cannot replace an installed runtime',async()=>{const f=await fixture();try{await mkdir(join(f.dest,'.runtime'));await writeFile(join(f.dest,'.runtime/runtime.mjs'),'known');await writeFile(join(f.from,'runtime.mjs'),'tampered');await expect(installRuntime(f.from,f.dest)).rejects.toThrow('ARTIFACT_HASH_MISMATCH');expect(await readFile(join(f.dest,'.runtime/runtime.mjs'),'utf8')).toBe('known');}finally{await rm(f.dir,{recursive:true,force:true});}});
test('entrypoint traversal rejected before filesystem writes',async()=>{const f=await fixture();try{await writeFile(join(f.from,'manifest.json'),JSON.stringify({...f.manifest,entrypoint:'../../secret'}));await expect(installRuntime(f.from,f.dest)).rejects.toThrow('INVALID_RUNTIME_MANIFEST');}finally{await rm(f.dir,{recursive:true,force:true});}});
