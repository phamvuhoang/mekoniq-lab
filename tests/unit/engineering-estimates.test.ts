import {expect,test} from 'vitest';
import {engineeringEstimateInputs} from '../../src/design/engineering-estimates';
import {estimateDrive} from '../../src/estimates/drive';
import {makeEngineeringArchive} from '../support/engineering';

test('drive inputs come from the design: wheel radius, ratio, efficiency and total AMR mass',()=>{
  const archive=makeEngineeringArchive(),r=engineeringEstimateInputs(archive.manifest.project,archive);
  expect(r.drive).toMatchObject({wheelRadiusM:0.1,drivenWheels:2,gearRatio:10,gearEfficiency:0.8});
  expect(r.drive!.massKg).toBeCloseTo(20+2*(0.2+1.5)+6+1.2,9);
  expect(r.drive!.peakMotorTorqueNm).toBeCloseTo(3/(10*0.8),9);
  const est=estimateDrive({...r.drive!,accelerationMps2:0.5,rollingResistance:0.02,slopeRadians:0});
  expect(est!.continuousTorqueStatus).toBe('missing');   // no continuous rating is stated, so none is assumed
  expect(est!.wheelTorqueNm).toBeCloseTo((r.drive!.massKg*0.5+0.02*r.drive!.massKg*9.81)*0.1/2,9);
});
test('a change in the design changes the inputs, with no preset values behind it',()=>{
  const archive=makeEngineeringArchive();
  const heavier=structuredClone(archive);
  heavier.manifest.components.find(c=>c.id==='amr-chassis')!.links[0]!.massKg.value=25;
  heavier.manifest.project.assembly.instances.forEach(()=>{});
  const before=engineeringEstimateInputs(archive.manifest.project,archive).drive!.massKg;
  const after=engineeringEstimateInputs(heavier.manifest.project,heavier);
  // the edited component has a new digest, so the instance no longer resolves: reported, not silently the old mass
  expect(after.problems.map(p=>p.code)).toContain('COMPONENT_MISSING');
  expect(before).toBeGreaterThan(0);
});
test('missing model blob, capacity and support polygon are reported and nothing is borrowed',()=>{
  const draft=makeEngineeringArchive({omitBlobs:true}),r=engineeringEstimateInputs(draft.manifest.project,draft);
  expect(r.drive).toBeNull();
  expect(r.problems.map(p=>p.code)).toEqual(expect.arrayContaining(['MODEL_BLOB_MISSING','DRIVE_MODEL_UNAVAILABLE','ENERGY_CAPACITY_UNAVAILABLE','STABILITY_UNAVAILABLE']));
  expect(r.stability).toBeNull();
  expect(r.energy).toEqual({volts:25.5});
});
