import {installRuntime} from './runtime-artifact.mjs';
import {fileURLToPath} from 'node:url';
if(!process.argv[2])throw new Error('Usage: node scripts/import-runtime.mjs /path/to/trusted/source-export');
const lock=await installRuntime(process.argv[2],fileURLToPath(new URL('../',import.meta.url)));
console.log(`Installed source ${lock.sourceCommit}, artifact ${lock.artifactSha256}`);
