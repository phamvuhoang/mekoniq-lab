import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../src/project/default';
import { summarizeDesign, validateDesign, capabilitiesFor } from '../../src/design/catalog';
import { validateProject } from '../../src/project/schema';
import { validateWorld } from '../../src/world/validation';
import { worldToScreen, screenToWorld } from '../../src/world/coordinates';
import { updateWorldPoint, invalidateWorldReferences } from '../../src/world/editor';

describe('illustrative service design', () => {
  it('recomputes trays without mutating the earlier revision', () => {
    const design=defaultProject().design;
    const before=summarizeDesign(design);
    const after=summarizeDesign({...design,trays:4,revision:2});
    expect(after.massKg!-before.massKg!).toBeCloseTo(1.1);
    expect(design.trays).toBe(3);
    expect(before.missingIds).toContain('lidar');
    expect(before.totalMinor).toBeNull();
    expect(before.lines.every(line=>line.provenance==='illustrative')).toBe(true);
  });
  it('locks unsupported Valetudo drivetrain controls', () => {
    const design={...defaultProject().design,chassis:'valetudo' as const,batteryAh:30};
    expect(capabilitiesFor(design).editableDrive).toBe(false);
    expect(capabilitiesFor(design).payloadVerified).toBe(false);
    expect(validateDesign(design).map(issue=>issue.code)).toContain('VALETUDO_DRIVETRAIN_LOCKED');
    expect(validateDesign({...design,chassis:'service',trays:5}).map(issue=>issue.code)).toContain('TRAY_RANGE');
    expect(summarizeDesign({...design,batteryAh:20})).toMatchObject({massKg:null,usableWh:null,runtimeHours:null});
  });
  it('validates component voltage and missing geometry before candidate promotion', () => {
    const design=defaultProject().design;
    const issues=validateDesign(design,[{id:'sensor',voltageMin:5,voltageMax:12,supplyVolts:24,massKg:1,widthM:0,heightM:0.2,lengthM:0.2}]);
    expect(issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['VOLTAGE_MISMATCH','MISSING_GEOMETRY']));
  });
});

describe('world geometry and import boundary', () => {
  it('roundtrips asymmetric SI coordinates with a flipped screen y axis', () => {
    const view={scale:20,offsetX:100,offsetY:300};
    expect(worldToScreen({x:3,y:7},view)).toEqual({x:160,y:160});
    expect(screenToWorld({x:160,y:160},view)).toEqual({x:3,y:7});
    expect(()=>screenToWorld({x:1,y:1},{...view,scale:0})).toThrow();
  });
  it('rejects duplicate IDs and points inside furniture rather than checking only canvas bounds', () => {
    const world=defaultProject().world;
    expect(validateWorld(world)).toEqual([]);
    const bad={...world,points:[...world.points,{...world.points[0],id:world.points[1].id,x:3,y:2}]};
    expect(validateWorld(bad).map(issue=>issue.code)).toEqual(expect.arrayContaining(['DUPLICATE_ID','POINT_IN_OBSTACLE']));
    const narrow={...world,points:world.points.map(p=>p.id==='table-1' ? {...p,y:1.4} : p)};
    expect(validateWorld(narrow,{robotRadiusM:0.3}).map(issue=>issue.code)).toContain('FOOTPRINT_COLLISION');
  });
  it('edits coordinates immutably and invalidates old reports and bindings', () => {
    const world=defaultProject().world;
    const moved=updateWorldPoint(world,'table-1',{x:2,y:1});
    expect(moved.revision).toBe(world.revision+1);
    expect(world.points[0].x).not.toBe(2);
    expect(invalidateWorldReferences(moved,[{id:'report-old',worldId:world.id,worldRevision:world.revision},{id:'binding-current',worldId:world.id,worldRevision:moved.revision}])).toEqual(['report-old']);
    expect(()=>updateWorldPoint(world,'missing',{x:2})).toThrow(/UNKNOWN/);
  });
  it('rejects unknown fields, nonfinite numbers and unsupported import schemas', () => {
    const project=defaultProject();
    expect(validateProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    expect(()=>validateProject({...project,schemaVersion:2})).toThrow();
    expect(()=>validateProject({...project,secret:'no'})).toThrow();
    expect(()=>validateProject({...project,design:{...project.design,batteryAh:Infinity}})).toThrow();
    expect(()=>validateProject({...project,world:{...project.world,points:Array.from({length:201},(_,i)=>({...project.world.points[0],id:`p-${i}`}))}})).toThrow();
  });
});
