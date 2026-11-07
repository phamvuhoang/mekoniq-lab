import type {ComponentRevision,EngineeringProject,Problem} from '../shared/engineering';
import type {DriveInput} from '../estimates/drive';
import type {EnergyInput} from '../estimates/energy';
import type {StabilityInput} from '../estimates/stability';
import type {EngineeringArchiveFiles} from '../project/engineering-archive';
import {componentDigest} from '../project/engineering-archive';

export interface EngineeringEstimateInputs {
  energy:EnergyInput|null;
  /** Everything the assembly can supply; acceleration, rolling resistance and slope are scenario choices the caller adds. */
  drive:Omit<DriveInput,'accelerationMps2'|'rollingResistance'|'slopeRadians'>|null;
  stability:StabilityInput|null;
  problems:Problem[];
}
type Scalar={value:number};
const miss=(code:string,path:string,detail:string):Problem=>({code,path,blocking:false,detail});
/**
 * Inputs for the existing calculators, taken only from the engineering design and its local closure. A value the design does not state stays absent and is reported;
 * service-preset numbers are never borrowed.
 */
export function engineeringEstimateInputs(project:EngineeringProject,content:EngineeringArchiveFiles):EngineeringEstimateInputs {
  const problems:Problem[]=[],byDigest=new Map<string,ComponentRevision>(content.manifest.components.map(c=>[componentDigest(c),c]));
  const parts=project.assembly.instances.map(i=>({instance:i,component:byDigest.get(i.componentDigest)}));
  for (const p of parts) if (!p.component) problems.push(miss('COMPONENT_MISSING',`/assembly/instances/${p.instance.id}`,'component revision is not in the local closure'));
  const known=parts.filter(p=>p.component);
  const amr=project.runtimeProject.entities.find(e=>e.kind==='amr');
  const bound=new Set(project.entityBindings.find(b=>b.entityId===amr?.id)?.instanceIds??[]);
  const mine=known.filter(p=>bound.has(p.instance.id));
  // drive: the AMR's drive model is the single source of wheel radius, ratio and efficiency
  let drive:EngineeringEstimateInputs['drive']=null;
  const modelOf=(c:ComponentRevision)=>c.models.filter(m=>m.kind==='actuator').flatMap(m=>{
    const bytes=content.files[`blobs/${m.digest}`];
    if (!bytes) {problems.push(miss('MODEL_BLOB_MISSING',`/components/${c.id}/models/${m.id}`,m.digest));return [];}
    return [JSON.parse(new TextDecoder().decode(bytes)) as {drive?:{wheelRadiusM:Scalar};transmission:{ratio:Scalar;efficiency:Scalar};torqueSpeedTable:{torque:Scalar}[]}];
  });
  const driveModel=mine.flatMap(p=>modelOf(p.component!)).find(m=>m.drive);
  if (!amr) problems.push(miss('NO_AMR_ENTITY','/runtimeProject/entities','the project has no AMR'));
  else if (!driveModel) problems.push(miss('DRIVE_MODEL_UNAVAILABLE',`/entityBindings/${amr.id}`,'no drive model with explicit wheel radius is available'));
  else {
    const ratio=driveModel.transmission.ratio.value,eff=driveModel.transmission.efficiency.value,stall=Math.max(...driveModel.torqueSpeedTable.map(r=>r.torque.value));
    const massKg=mine.flatMap(p=>p.component!.links).reduce((n,l)=>n+l.massKg.value,0);
    drive={massKg,wheelRadiusM:driveModel.drive!.wheelRadiusM.value,drivenWheels:2,gearRatio:ratio,gearEfficiency:eff,peakMotorTorqueNm:stall/(ratio*eff)};
    // no continuous rating is stated by the model, so the calculator reports it as missing rather than assuming one
  }
  // energy: voltage comes from the battery's power port; capacity is not a catalog field yet
  const battery=mine.map(p=>p.component!).flatMap(c=>c.ports).find(p=>p.kind==='power'&&p.direction==='out'&&p.voltageRangeV);
  const energy:EnergyInput|null=battery?{volts:(battery.voltageRangeV![0]+battery.voltageRangeV![1])/2}:null;
  problems.push(miss('ENERGY_CAPACITY_UNAVAILABLE','/components','the catalog has no battery capacity (Ah); the runtime estimate stays unavailable'));
  problems.push(miss('STABILITY_UNAVAILABLE','/components','the catalog defines no support polygon; stability needs the resolved assembly and contact points'));
  return {energy,drive,stability:null,problems};
}
