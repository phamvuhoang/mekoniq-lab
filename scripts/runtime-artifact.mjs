import {readFile,writeFile,mkdir,rename,stat,rm,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {auditBundle} from './runtime-audit.mjs';
export const digest=(value)=>createHash('sha256').update(value).digest('hex');
// Protocol majors this Lab speaks: v1 (S01 business_sim) and v2 (twin, FD01/BV01). An artifact offering anything else needs a Lab update first.
export const LAB_PROTOCOL_MAJORS=[1,2];
const SCHEMA_NAME=/^[a-z0-9][a-z0-9.-]*\.json$/;
export function validateManifest(m) {
 if(m?.dirty!==false)throw new Error('DIRTY_SOURCE_ARTIFACT');
 if(!m||typeof m!=='object'||!Number.isInteger(m.protocolMajor)||m.nodeMajor!==24||typeof m.packageVersion!=='string'||!/^v?24\.\d+\.\d+$/.test(m.toolchain?.node)||m.entrypoint!=='runtime.mjs'||!/^[a-f0-9]{40}$/.test(m.sourceCommit)||!/^[a-f0-9]{64}$/.test(m.schemaHash)||!/^[a-f0-9]{64}$/.test(m.artifactSha256)) throw new Error('INVALID_RUNTIME_MANIFEST');
 const majors=m.protocolMajors??[m.protocolMajor];
 if(!Array.isArray(majors)||!majors.includes(m.protocolMajor)||!majors.every(n=>LAB_PROTOCOL_MAJORS.includes(n)))throw new Error(`UNSUPPORTED_PROTOCOL:${majors}`);
 if(m.schemas!==undefined&&(!Array.isArray(m.schemas)||m.schemas.length>256||!m.schemas.every(n=>typeof n==='string'&&SCHEMA_NAME.test(n))))throw new Error('INVALID_RUNTIME_MANIFEST');
 return m;
}
const lockOf=(m)=>({dirty:false,packageVersion:m.packageVersion,toolchain:{node:m.toolchain.node},sourceCommit:m.sourceCommit,schemaHash:m.schemaHash,protocolMajor:m.protocolMajor,...(m.protocolMajors?{protocolMajors:m.protocolMajors}:{}),nodeMajor:m.nodeMajor,artifactSha256:m.artifactSha256,entrypoint:m.entrypoint});
/** Write JSON through a temporary sibling and one rename: a crash leaves the old file or the new one, never half of one. */
async function writeAtomic(file,value){const tmp=join(resolve(file,'..'),`.${randomUUID()}.tmp`);try{await writeFile(tmp,JSON.stringify(value,null,2)+'\n');await rename(tmp,file);}finally{await rm(tmp,{force:true});}}
async function writeLock(root,lock){await mkdir(join(root,'config'),{recursive:true});await writeAtomic(join(root,'config','source-runtime.lock.json'),lock);}
const intact=async(directory,sha)=>{try{return digest(await readFile(join(directory,'runtime.mjs')))===sha;}catch{return false;}};
const readLock=async(root)=>{try{return JSON.parse(await readFile(join(root,'config/source-runtime.lock.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
/** One transaction: manifest/protocol check, runtime hash, contract schemas re-hashed against the manifest, staged content-addressed copy, then one atomic lock rename.
 * Any failure leaves the current lock and installed artifacts untouched. The previous lock is kept in .runtime/rollback.lock.json (its artifact stays installed). */
export async function installRuntime(from,destination) {
 const input=resolve(from),root=resolve(destination);
 if((await stat(join(input,'manifest.json'))).size>65536) throw new Error('INVALID_RUNTIME_MANIFEST');
 const manifest=validateManifest(JSON.parse(await readFile(join(input,'manifest.json'),'utf8')));
 if((await stat(join(input,'runtime.mjs'))).size>64*1024*1024) throw new Error('ARTIFACT_TOO_LARGE');
 const bytes=await readFile(join(input,'runtime.mjs'));
 if(digest(bytes)!==manifest.artifactSha256)throw new Error('ARTIFACT_HASH_MISMATCH');
 auditBundle(bytes.toString('utf8'));
 const schemas=[];
 if(manifest.schemas){
  const names=[...manifest.schemas].sort(),hash=createHash('sha256');
  if(JSON.stringify((await readdir(join(input,'schemas'))).filter(n=>n.endsWith('.json')).sort())!==JSON.stringify(names))throw new Error('SCHEMA_SET_MISMATCH');
  for(const name of names){const b=await readFile(join(input,'schemas',name));hash.update(name+'\n').update(b);schemas.push([name,b]);}
  if(hash.digest('hex')!==manifest.schemaHash)throw new Error('SCHEMA_HASH_MISMATCH');
 }
 const runtimes=join(root,'.runtime'),directory=join(runtimes,manifest.artifactSha256),staging=join(runtimes,`.staging-${randomUUID()}`);
 // an installed, verified copy of the same SHA stays where it is: removing it before the rename would leave the lock pointing at nothing
 if(!await intact(directory,manifest.artifactSha256)){
 await mkdir(join(staging,'schemas'),{recursive:true});
 try{
  await writeFile(join(staging,'runtime.mjs'),bytes);
  await writeFile(join(staging,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const [name,b] of schemas)await writeFile(join(staging,'schemas',name),b);
  await rm(directory,{recursive:true,force:true});
  await rename(staging,directory);
 }finally{await rm(staging,{recursive:true,force:true});}
 }
 const previous=await readLock(root),lock=lockOf(manifest);
 await writeLock(root,lock);
 // the rollback record is written only once the new lock is in place, and atomically
 if(previous&&previous.artifactSha256!==lock.artifactSha256)await writeAtomic(join(runtimes,'rollback.lock.json'),previous);
 return lock;
}
/** Re-select the previously pinned artifact (swap with the current one) after verifying it is still installed intact. */
export async function rollbackRuntime(destination) {
 const root=resolve(destination),file=join(root,'.runtime/rollback.lock.json');
 const previous=validateManifest(JSON.parse(await readFile(file,'utf8').catch(()=>{throw new Error('NO_ROLLBACK_RUNTIME');})));
 if(digest(await readFile(join(root,'.runtime',previous.artifactSha256,previous.entrypoint)))!==previous.artifactSha256)throw new Error('ARTIFACT_HASH_MISMATCH');
 const current=await readLock(root);
 await writeLock(root,previous);
 if(current)await writeAtomic(file,current);
 return previous;
}
export async function checkedRuntime(root) {
 const lock=validateManifest(JSON.parse(await readFile(join(root,'config/source-runtime.lock.json'),'utf8')));
 const file=join(root,'.runtime',lock.artifactSha256,lock.entrypoint);
 const bytes=await readFile(file);
 if(digest(bytes)!==lock.artifactSha256)throw new Error('ARTIFACT_HASH_MISMATCH');
 return {lock,file};
}
