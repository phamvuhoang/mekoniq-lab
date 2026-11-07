import {expect,test} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {EngineeringProjectStore} from '../../src/project/engineering-store';
import {catalogFromArchive,mergeCatalog,archiveFor,parseArchive,referenceCatalog,referenceProject,serializeArchive} from '../../src/design/assembly';
import {checkArchive} from '../../src/project/engineering-archive';
import {makeEngineeringArchive,richArchive} from '../support/engineering';
import {hashJson} from '../../src/twin/hash';

const normalised=(a:ReturnType<typeof makeEngineeringArchive>)=>({...a.manifest,blobs:[...a.manifest.blobs].sort((x,y)=>x.digest<y.digest?-1:1),missingDigests:[...a.manifest.missingDigests].sort(),files:Object.fromEntries(Object.entries(a.files).map(([k,v])=>[k,Array.from(v)]))});

test('an imported archive exports back unchanged: every blob with its media type and license, assets and recipes included',()=>{
  const a=richArchive(),catalog=catalogFromArchive(a),out=archiveFor(a.manifest.project,catalog);
  expect(normalised(out)).toEqual(normalised(a));
  expect(checkArchive(out)).toMatchObject({ok:true,missing:[]});
  expect(out.manifest.blobs.find(b=>b.mediaType==='text/plain')!.license).toBe('MIT');
  expect(out.manifest.blobs.find(b=>b.mediaType==='model/stl')).toBeDefined();
});
test('an archive that still lacks its blobs exports a consistent missing list, mesh included',()=>{
  const a=richArchive();
  for (const b of a.manifest.blobs) delete a.files[b.file];
  const missing=a.manifest.blobs.map(b=>b.digest).sort();
  a.manifest.blobs=[];a.manifest.missingDigests=missing;
  expect(checkArchive(a)).toMatchObject({ok:true});
  const out=archiveFor(a.manifest.project,catalogFromArchive(a));
  expect(checkArchive(out)).toMatchObject({ok:true});
  expect([...out.manifest.missingDigests].sort()).toEqual(missing);
});
test('opening the reference after an import does not make the imported project lose its components',()=>{
  const a=richArchive(),catalog=catalogFromArchive(a);
  mergeCatalog(catalog,referenceCatalog());
  const out=archiveFor(a.manifest.project,catalog);
  expect(checkArchive(out)).toMatchObject({ok:true});
  expect(normalised(out)).toEqual(normalised(a));
  expect(archiveFor(referenceProject(),catalog).manifest.assets).toEqual([]);   // the imported asset belongs to the imported project only
});
test('loading a saved project keeps its identity (revision and digest); only edits and undo/redo make new revisions',()=>{
  const saved={...referenceProject(),revision:3},store=new EngineeringProjectStore(referenceProject());
  store.load(saved);
  expect(store.snapshot().revision).toBe(3);
  expect(hashJson(store.snapshot())).toBe(hashJson(saved));
  store.replaceDraft({...store.getDraft(),assembly:{instances:[],connections:[]}});
  expect(store.snapshot().revision).toBe(4);
  store.undo();
  expect(store.snapshot().assembly).toEqual(saved.assembly);
});
test('reset restores a project without keeping any earlier history',()=>{
  const store=new EngineeringProjectStore(referenceProject());
  store.replaceDraft({...store.getDraft(),assembly:{instances:[],connections:[]}});
  store.reset({...referenceProject(),revision:7});
  expect(store.snapshot().revision).toBe(7);
  expect(store.undo()).toBe(false);
});

test('the checked-in rich archive fixture is exactly what richArchive() builds (UPDATE_FIXTURES=1 rewrites it)',()=>{
  const url=new URL('../../fixtures/engineering/rich-archive.json',import.meta.url),wire=serializeArchive(richArchive());
  if (process.env.UPDATE_FIXTURES==='1') writeFileSync(url,wire);
  const stored=parseArchive(readFileSync(url,'utf8'));
  expect(checkArchive(stored)).toMatchObject({ok:true});
  expect(normalised(stored)).toEqual(normalised(richArchive()));
});
