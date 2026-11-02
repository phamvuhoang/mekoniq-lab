import {checkedRuntime} from './runtime-artifact.mjs';
import {fileURLToPath} from 'node:url';
try {const {lock}=await checkedRuntime(fileURLToPath(new URL('../',import.meta.url)));console.log(`Verified source ${lock.sourceCommit}; schema ${lock.schemaHash}; Node ${lock.nodeMajor}`);}
catch(e){console.error(`Runtime unavailable: ${e.message}. Install a pinned export with node scripts/import-runtime.mjs <directory>.`);process.exitCode=1;}
