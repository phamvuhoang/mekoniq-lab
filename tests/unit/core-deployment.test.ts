import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../src/project/default';
import { buildBundle, validateBundle } from '../../src/deployment/bundle';

describe('draft deployment bundle', () => {
  it('exports hashed inputs without promoting simulation into hardware validation', async () => {
    const project=defaultProject();
    const bundle=await buildBundle(project,[{id:'sim-1',mode:'business_sim',outcome:'completed'}]);
    expect(bundle.status).toBe('draft');
    expect(bundle.readiness.find(item=>item.id==='hardware')?.status).toBe('blocked_external');
    expect(bundle.hashes.design).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.hashes.candidate).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.payload.profileCandidate.validation).toBe('simulated');
    expect((await validateBundle(bundle)).ok).toBe(true);
    expect(Object.keys(bundle.files)).toContain('checksums.json');
  });
  it('changes hashes with configuration revisions and detects tampering', async () => {
    const project=defaultProject();
    const before=await buildBundle(project);
    const after=await buildBundle({...project,design:{...project.design,trays:4,revision:2}});
    expect(before.hashes.design).not.toBe(after.hashes.design);
    expect(before.hashes.candidate).not.toBe(after.hashes.candidate);
    before.payload.design.trays=4;
    expect((await validateBundle(before)).ok).toBe(false);
  });
  it('rejects live state, credentials and forged validation in candidate inputs', async () => {
    const project=defaultProject();
    await expect(buildBundle({...project,missions:[]} as typeof project)).rejects.toThrow();
    await expect(buildBundle(project,[{id:'fake',mode:'hardware_test',validation:'hardware_validated'}])).rejects.toThrow(/VALIDATION/);
    await expect(buildBundle(project,[{id:'secret',password:'no'}])).rejects.toThrow(/FORBIDDEN/);
    const bundle=await buildBundle(project);
    (bundle.payload as unknown as Record<string,unknown>).missions=[];
    expect((await validateBundle(bundle)).ok).toBe(false);
  });
});
