import fixture from '../../fixtures/engineering/valid.json';
import type {BundleReceipt,ComponentRevision,EngineeringArchive,EngineeringProject} from '../../src/shared/engineering';
import type {EngineeringArchiveFiles} from '../../src/project/engineering-archive';
import {componentDigest} from '../../src/project/engineering-archive';
import {canonicalJson,hashJson,sha256Hex} from '../../src/twin/hash';

const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
export const makeEngineeringProject=():EngineeringProject=>clone(fixture.project) as unknown as EngineeringProject;
const components=():ComponentRevision[]=>Object.values(clone(fixture.components)) as unknown as ComponentRevision[];
/**
 * A complete archive: the reference AMR, its drive-model JSON and a datasheet blob, with real content hashes. The chassis cites the datasheet and the model by digest,
 * so the closure is non-trivial. `omitBlobs` drops the blob files (a draft exported without them lists them in missingDigests).
 */
export function makeEngineeringArchive(options:{omitBlobs?:boolean}={}):EngineeringArchiveFiles {
  const project=makeEngineeringProject(),list=components();
  const datasheet=new TextEncoder().encode('assumed datasheet for the fixture chassis'),datasheetDigest=sha256Hex(datasheet);
  const model=Object.values(fixture.models)[0] as object,modelBytes=new TextEncoder().encode(canonicalJson(model)),modelDigest=sha256Hex(modelBytes);
  const old=list.find(c=>c.id==='amr-chassis')!,oldDigest=componentDigest(old);
  const chassis={...old,documents:[{id:'datasheet',url:null,digest:datasheetDigest,license:'MIT'}],models:old.models.map(m=>({...m,digest:modelDigest}))};
  list[list.indexOf(old)]=chassis;
  for (const i of project.assembly.instances) if (i.componentDigest===oldDigest) i.componentDigest=componentDigest(chassis);
  const blobs=[{digest:datasheetDigest,file:`blobs/${datasheetDigest}`,mediaType:'text/plain',license:'MIT',sizeBytes:datasheet.length},{digest:modelDigest,file:`blobs/${modelDigest}`,mediaType:'application/json',license:'MIT',sizeBytes:modelBytes.length}];
  const manifest:EngineeringArchive={documentType:'engineering-project-archive',schemaVersion:1,project,components:list,assets:[],recipes:[],blobs:options.omitBlobs?[]:blobs,missingDigests:options.omitBlobs?[datasheetDigest,modelDigest].sort():[]};
  return {manifest,files:options.omitBlobs?{}:{[blobs[0]!.file]:datasheet,[blobs[1]!.file]:modelBytes}};
}
/** A compiled receipt for exactly this project, for portable client tests only (no server compiled it). */
export function makeEngineeringReceipt(project:EngineeringProject):Extract<BundleReceipt,{state:'compiled'}> {
  const projectDigest=hashJson(project);
  return {projectDigest,profile:project.requestedProfile,problems:[],state:'compiled',bundleDigest:hashJson({bundleOf:projectDigest}),assemblyDigest:hashJson({assemblyOf:projectDigest}),sceneDigest:hashJson({sceneOf:projectDigest}),runnable:false};
}
