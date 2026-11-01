import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const digest=(value)=>createHash('sha256').update(value).digest('hex');
export function validateManifest(m) {
 if(!m||typeof m!=='object'||m.protocolMajor!==1||m.nodeMajor!==24||m.entrypoint!=='runtime.mjs'||!/^[a-f0-9]{40}$/.test(m.sourceCommit)||!/^[a-f0-9]{64}$/.test(m.schemaHash)||!/^[a-f0-9]{64}$/.test(m.artifactSha256)) throw new Error('INVALID_RUNTIME_MANIFEST');
 return m;
}
export async function installRuntime(from,destination) {
 const input=resolve(from),root=resolve(destination);
 if((await stat(join(input,'manifest.json'))).size>65536) throw new Error('INVALID_RUNTIME_MANIFEST');
 const manifest=validateManifest(JSON.parse(await readFile(join(input,'manifest.json'),'utf8')));
 if((await stat(join(input,'runtime.mjs'))).size>64*1024*1024) throw new Error('ARTIFACT_TOO_LARGE');
 const bytes=await readFile(join(input,'runtime.mjs'));
 if(digest(bytes)!==manifest.artifactSha256)throw new Error('ARTIFACT_HASH_MISMATCH');
 // Immutable content-addressed install, then one atomic lock update. A failed install preserves previous selection.
 const directory=join(root,'.runtime',manifest.artifactSha256);
 await mkdir(directory,{recursive:true});
 await writeFile(join(directory,'runtime.mjs'),bytes);
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await mkdir(join(root,'config'),{recursive:true});
 const lock={sourceCommit:manifest.sourceCommit,schemaHash:manifest.schemaHash,protocolMajor:manifest.protocolMajor,nodeMajor:manifest.nodeMajor,artifactSha256:manifest.artifactSha256,entrypoint:manifest.entrypoint};
 const tmp=join(root,'config',`.source-lock-${randomUUID()}.json`);
 await writeFile(tmp,JSON.stringify(lock,null,2)+'\n');
 await rename(tmp,join(root,'config','source-runtime.lock.json'));
 return lock;
}
export async function checkedRuntime(root) {
 const lock=validateManifest(JSON.parse(await readFile(join(root,'config/source-runtime.lock.json'),'utf8')));
 const file=join(root,'.runtime',lock.artifactSha256,lock.entrypoint);
 const bytes=await readFile(file);
 if(digest(bytes)!==lock.artifactSha256)throw new Error('ARTIFACT_HASH_MISMATCH');
 return {lock,file};
}
