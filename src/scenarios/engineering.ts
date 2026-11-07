import type {CompiledScene} from '../shared/engineering';
import type {TwinRuntime} from './controls';
import {TwinRuntimeError} from './controls';
/** Reads the compiler's own scene.json out of a compiled bundle; nothing else may be drawn as "the compiled robot". */
export async function loadCompiledScene(runtime:TwinRuntime,bundleDigest:string):Promise<CompiledScene> {
  if (!runtime.engineeringManifest||!runtime.engineeringBlob) throw new TwinRuntimeError('ENGINEERING_CAPABILITY_REQUIRED',[],0);
  const manifest=await runtime.engineeringManifest(bundleDigest),entry=manifest.files.find(f=>f.path==='scene.json');
  if (!entry||entry.sha256!==manifest.sceneDigest) throw new TwinRuntimeError('ENGINEERING_SCENE_MISSING',[],409);
  return JSON.parse(new TextDecoder().decode(await runtime.engineeringBlob(entry.sha256))) as CompiledScene;
}
/** The bundle's bill of materials, from its own bom.json. */
export async function loadBom(runtime:TwinRuntime,bundleDigest:string):Promise<import('../shared/engineering').Bom> {
  const manifest=await runtime.engineeringManifest!(bundleDigest),entry=manifest.files.find(f=>f.path==='bom.json');
  if (!entry) throw new TwinRuntimeError('ENGINEERING_BOM_MISSING',[],409);
  return JSON.parse(new TextDecoder().decode(await runtime.engineeringBlob!(entry.sha256)));
}
