// Command-line options of the regression recorder, separate so the rules (a new evidence root must be new; the legacy default is unchanged) can be tested without recording.
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
export const LEGACY_ROOT='docs/implementation/evidence/digital-twin-v2/regression';
export const SUITES=['legacy','physical-robot-lab'];
export function parseRecorderArgs(argv,lab,{exists=existsSync}={}){
 const o={ci:false,suite:'legacy',out:resolve(lab,LEGACY_ROOT),explicitOut:false};
 for(let i=0;i<argv.length;i++){
  const a=argv[i];
  if(a==='--ci')o.ci=true;
  else if(a==='--suite'){o.suite=argv[++i];if(!SUITES.includes(o.suite))throw new Error(`UNKNOWN_SUITE:${o.suite}`);}
  else if(a==='--out'){if(!argv[i+1])throw new Error('OUT_REQUIRED');o.out=resolve(lab,argv[++i]);o.explicitOut=true;}
  else throw new Error(`UNKNOWN_ARGUMENT:${a}`);
 }
 // the physical-robot-lab gate never reuses or replaces an evidence directory, and never writes into the historical digital-twin-v2 root
 if(o.suite==='physical-robot-lab'){
  if(!o.explicitOut)throw new Error('OUT_REQUIRED_FOR_SUITE');
  if(o.out===resolve(lab,LEGACY_ROOT))throw new Error('LEGACY_ROOT_FORBIDDEN');
 }
 if(o.explicitOut&&exists(o.out))throw new Error('OUT_EXISTS');
 return o;
}
