import {describe,expect,test} from 'vitest';
// @ts-expect-error plain ESM script
import {parseRecorderArgs,LEGACY_ROOT} from '../../scripts/recorder-options.mjs';

const lab='/work/lab',none={exists:()=>false};
describe('recorder options',()=>{
  test('no arguments keep the legacy behaviour and root',()=>{
    expect(parseRecorderArgs([],lab,none)).toEqual({ci:false,suite:'legacy',out:`${lab}/${LEGACY_ROOT}`,explicitOut:false});
    expect(parseRecorderArgs(['--ci'],lab,none).ci).toBe(true);
  });
  test('the physical suite needs an explicit, new root that is not the historical one',()=>{
    const o=parseRecorderArgs(['--suite','physical-robot-lab','--out','docs/implementation/evidence/physical-robot-lab/regression'],lab,none);
    expect(o).toMatchObject({suite:'physical-robot-lab',out:`${lab}/docs/implementation/evidence/physical-robot-lab/regression`,explicitOut:true});
    expect(()=>parseRecorderArgs(['--suite','physical-robot-lab'],lab,none)).toThrow('OUT_REQUIRED_FOR_SUITE');
    expect(()=>parseRecorderArgs(['--suite','physical-robot-lab','--out',LEGACY_ROOT],lab,none)).toThrow('LEGACY_ROOT_FORBIDDEN');
  });
  test('an existing directory is never overwritten or deleted',()=>{
    expect(()=>parseRecorderArgs(['--suite','physical-robot-lab','--out','x'],lab,{exists:()=>true})).toThrow('OUT_EXISTS');
  });
  test('unknown suites, options and a dangling --out are refused',()=>{
    expect(()=>parseRecorderArgs(['--suite','nope'],lab,none)).toThrow('UNKNOWN_SUITE:nope');
    expect(()=>parseRecorderArgs(['--wat'],lab,none)).toThrow('UNKNOWN_ARGUMENT:--wat');
    expect(()=>parseRecorderArgs(['--out'],lab,none)).toThrow('OUT_REQUIRED');
  });
});
