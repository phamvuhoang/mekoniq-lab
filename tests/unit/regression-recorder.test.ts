import {describe,expect,test} from 'vitest';
// @ts-expect-error plain ESM script
import {parseRecorderArgs,LEGACY_ROOT,physicalPlan,listArtifacts,notExecuted} from '../../scripts/recorder-options.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

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

describe('physical-robot-lab plan',()=>{
  const plan=physicalPlan('/new/root');
  test('browser screenshots go into the new recording, never into the committed brand evidence',()=>{
    expect(plan.browserEnv.LAB_BRAND_EVIDENCE_DIR).toBe('/new/root/brand-ui');
    expect(plan.browserEnv.LAB_EVIDENCE_DIR).toBe('/new/root/screens');
    expect(plan.dirs).toEqual(expect.arrayContaining(['/new/root/brand-ui','/new/root/screens']));
    const spec=readFileSync(new URL('../e2e/brand-ui.spec.ts',import.meta.url),'utf8');
    expect(spec).toMatch(/LAB_BRAND_EVIDENCE_DIR/);
    expect(spec).not.toMatch(/evidence\/brand-ui-v1/);          // a plain Playwright run must not rewrite committed evidence
  });
  test('the offline package runs the dedicated BV01 gate with its own result file, besides recovery and the coffee journey',()=>{
    expect(plan.offlineSpecs).toEqual(['twin-recovery.spec.ts','coffee-journey.spec.ts','offline-bv01.spec.ts']);
    expect(plan.offlineFiles).toEqual(['lab-pw-offline-twin-recovery.json','lab-pw-offline-coffee-journey.json','lab-pw-offline-offline-bv01.json']);
  });
  test('every screenshot a run produced is listed with its sha256',()=>{
    const dir=mkdtempSync(join(tmpdir(),'rec-art-'));mkdirSync(join(dir,'sub'));writeFileSync(join(dir,'a.png'),'one');writeFileSync(join(dir,'sub','b.png'),'two');
    const rows=listArtifacts(dir,'screens');
    expect(rows.map((r:{file:string})=>r.file)).toEqual(['screens/a.png','screens/sub/b.png']);
    expect(rows[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(listArtifacts(join(dir,'missing'),'x')).toEqual([]);
  });
  test('a gate that was skipped or ran nothing is not recorded as passed',()=>{
    expect(notExecuted({expected:1,unexpected:0,skipped:0,flaky:0})).toBeNull();
    expect(notExecuted({expected:0,unexpected:0,skipped:1,flaky:0})).toMatch(/skipped/);
    expect(notExecuted({expected:1,unexpected:0,skipped:1,flaky:0})).toMatch(/skipped/);
    expect(notExecuted({expected:0,unexpected:0,skipped:0,flaky:0})).toMatch(/no test ran/);
    expect(notExecuted(undefined)).toMatch(/no result/);
  });
});
