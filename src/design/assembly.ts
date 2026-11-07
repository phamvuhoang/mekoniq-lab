import reference from '../../fixtures/engineering/reference-catalog.json' with {type:'json'};
import type {ComponentRevision,EngineeringProject,Problem} from '../shared/engineering';
import {componentDigest,type EngineeringArchiveFiles} from '../project/engineering-archive';
import {canonicalJson,sha256Hex} from '../twin/hash';

/** Catalog content the page edits against: component revisions by digest and the model JSON their ModelRefs name. */
export interface AssemblyCatalog {components:Record<string,ComponentRevision>;models:Record<string,unknown>}
export const referenceCatalog=():AssemblyCatalog=>structuredClone({components:reference.components,models:reference.models}) as unknown as AssemblyCatalog;
export const referenceProject=():EngineeringProject=>structuredClone(reference.project) as unknown as EngineeringProject;
const IDENTITY={xyzM:[0,0,0] as [number,number,number],quaternionXyzw:[0,0,0,1] as [number,number,number,number]};
const problem=(code:string,path:string,detail:string):Problem=>({code,path,blocking:true,detail});

export function uniqueInstanceId(project:EngineeringProject,base:string):string {
  const taken=new Set(project.assembly.instances.map(i=>i.id));
  if (!taken.has(base)) return base;
  for (let n=2;;n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
export function addInstance(project:EngineeringProject,digest:string,id:string,entityId?:string):EngineeringProject {
  const next=structuredClone(project);
  next.assembly.instances.push({id,componentDigest:digest,pose:structuredClone(IDENTITY)});
  const target=next.entityBindings.find(b=>b.entityId===entityId);
  if (target) target.instanceIds.push(id);
  return next;
}
/** Removing an instance also removes its connections and bindings, so nothing dangles. */
export function removeInstance(project:EngineeringProject,id:string):EngineeringProject {
  const next=structuredClone(project);
  next.assembly.instances=next.assembly.instances.filter(i=>i.id!==id);
  next.assembly.connections=next.assembly.connections.filter(c=>!c.from.startsWith(`${id}/`)&&!c.to.startsWith(`${id}/`));
  for (const b of next.entityBindings) b.instanceIds=b.instanceIds.filter(i=>i!==id);
  return next;
}
export function connect(project:EngineeringProject,from:string,to:string,kind:'mount'|'power'|'data'):EngineeringProject {
  const next=structuredClone(project);
  if (!next.assembly.connections.some(c=>c.from===from&&c.to===to&&c.kind===kind)) next.assembly.connections.push({from,to,kind});
  return next;
}
export function disconnect(project:EngineeringProject,index:number):EngineeringProject {
  const next=structuredClone(project);next.assembly.connections.splice(index,1);return next;
}
export const portsOf=(project:EngineeringProject,catalog:AssemblyCatalog,instanceId:string)=>catalog.components[project.assembly.instances.find(i=>i.id===instanceId)?.componentDigest??'']?.ports??[];

/**
 * Offline preview of the structural problems a person can fix by clicking. It is NOT the resolver: it knows nothing about geometry, inertia, voltage or penetration,
 * so a clean preview never means "valid"; only a server compile produces a receipt.
 */
export function previewProblems(project:EngineeringProject,catalog:AssemblyCatalog):Problem[] {
  const out:Problem[]=[],ports=(inst:string,port:string)=>portsOf(project,catalog,inst).find(p=>p.id===port);
  for (const i of project.assembly.instances) {
    if (!catalog.components[i.componentDigest]) out.push(problem('COMPONENT_UNAVAILABLE',`/assembly/instances/${i.id}`,i.componentDigest));
    else if (!project.entityBindings.some(b=>b.instanceIds.includes(i.id))) out.push(problem('INSTANCE_UNBOUND',`/assembly/instances/${i.id}`,'no entity owns this instance'));
  }
  for (const e of project.runtimeProject.entities) if (!project.entityBindings.find(b=>b.entityId===e.id)?.instanceIds.length) out.push(problem('UNBOUND_ENTITY',`/entityBindings/${e.id}`,`entity ${e.id} has no parts`));
  const usedMounts=new Map<string,number>(),parents=new Map<string,string>();
  project.assembly.connections.forEach((c,n)=>{
    const [fi='',fp='']=c.from.split('/'),[ti='',tp='']=c.to.split('/'),a=ports(fi,fp),b=ports(ti,tp);
    if (!a||!b) {out.push(problem('DANGLING_CONNECTION',`/assembly/connections/${n}`,`${c.from} → ${c.to}`));return;}
    if (c.kind!=='power') for (const end of [c.from,c.to]) {usedMounts.set(end,(usedMounts.get(end)??0)+1);if (usedMounts.get(end)!>1) out.push(problem('PORT_REUSED',`/assembly/connections/${n}`,end));}
    if (c.kind==='mount') {
      if (a.mate!==b.mate) out.push(problem('MOUNT_MISMATCH',`/assembly/connections/${n}`,`${a.mate} does not mate with ${b.mate}`));
      if (parents.has(ti)) out.push(problem('MULTIPLE_PARENT',`/assembly/connections/${n}`,ti));
      parents.set(ti,fi);
    }
  });
  return out;
}

/** The archive the repository stores/exports for this design: only the components it uses, their model JSON as content-addressed blobs; documents we do not hold are listed as missing. */
export function archiveFor(project:EngineeringProject,catalog:AssemblyCatalog):EngineeringArchiveFiles {
  const used=new Map<string,ComponentRevision>();
  for (const i of project.assembly.instances) {const c=catalog.components[i.componentDigest];if (c) used.set(componentDigest(c),c);}
  const files:Record<string,Uint8Array>={},blobs:EngineeringArchiveFiles['manifest']['blobs']=[];
  for (const c of used.values()) for (const m of c.models) {
    const model=catalog.models[m.digest];if (!model||files[`blobs/${m.digest}`]) continue;
    const bytes=new TextEncoder().encode(canonicalJson(model));
    if (sha256Hex(bytes)!==m.digest) continue;                      // never store a model under a digest it does not have
    files[`blobs/${m.digest}`]=bytes;blobs.push({digest:m.digest,file:`blobs/${m.digest}`,mediaType:'application/json',license:'internal',sizeBytes:bytes.length});
  }
  const have=new Set(blobs.map(b=>b.digest)),needed=[...new Set([...used.values()].flatMap(c=>[...c.documents.map(d=>d.digest),...c.models.map(m=>m.digest)]))].sort();
  return {manifest:{documentType:'engineering-project-archive',schemaVersion:1,project:structuredClone(project),components:[...used.values()],assets:[],recipes:[],blobs,missingDigests:needed.filter(d=>!have.has(d))},files};
}
/** Wire form of an archive for download: JSON with the blob bytes as base64. */
export function serializeArchive(a:EngineeringArchiveFiles):string {
  return JSON.stringify({manifest:a.manifest,files:Object.fromEntries(Object.entries(a.files).map(([k,v])=>[k,btoa(String.fromCharCode(...v))]))});
}
export function parseArchive(text:string):EngineeringArchiveFiles {
  const raw=JSON.parse(text) as {manifest?:unknown;files?:Record<string,string>};
  if (!raw||typeof raw!=='object'||!raw.manifest||!raw.files||typeof raw.files!=='object') throw new Error('ARCHIVE_SHAPE_INVALID');
  return {manifest:raw.manifest as EngineeringArchiveFiles['manifest'],files:Object.fromEntries(Object.entries(raw.files).map(([k,v])=>[k,Uint8Array.from(atob(v),c=>c.charCodeAt(0))]))};
}
