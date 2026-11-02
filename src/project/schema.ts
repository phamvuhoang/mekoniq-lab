import type {LabProject} from '../shared/types';
export const MAX_PROJECT_BYTES=5*1024*1024;
export const MAX_TRAYS=10;
export const MAX_WORLD_SIZE=1000;
function invalid(field:string):never {throw new Error(`INVALID_PROJECT:${field}`);}
function object(value:unknown,keys:readonly string[],field:string):Record<string,unknown> {
  if (!value||typeof value!=='object'||Array.isArray(value)) invalid(field);
  const record=value as Record<string,unknown>;
  if (Object.keys(record).some(key=>!keys.includes(key))||keys.some(key=>!(key in record))) invalid(field);
  return record;
}
function text(value:unknown,field:string):void {if (typeof value!=='string'||!value.trim()||value.length>200) invalid(field);}
function number(value:unknown,field:string,positive=false):void {if (typeof value!=='number'||!Number.isFinite(value)||(positive&&value<=0)) invalid(field);}
function revision(value:unknown,field:string):void {number(value,field,true);if (!Number.isSafeInteger(value)) invalid(field);}
/** Structural validation permits incomplete designs, while rejecting unsupported or executable fields. */
export function validateProject(value:unknown):LabProject {
  const project=object(value,['schemaVersion','id','name','revision','updatedAt','design','world'],'root');
  if (project.schemaVersion!==1) invalid('schemaVersion');
  text(project.id,'id');text(project.name,'name');revision(project.revision,'revision');
  if (typeof project.updatedAt!=='string'||!Number.isFinite(Date.parse(project.updatedAt))) invalid('updatedAt');
  const design=object(project.design,['id','revision','chassis','trays','batteryAh','sensor','payloadKg'],'design');
  text(design.id,'design.id');revision(design.revision,'design.revision');
  if (!['service','valetudo'].includes(String(design.chassis))) invalid('design.chassis');
  if (!['lidar','depth'].includes(String(design.sensor))) invalid('design.sensor');
  for (const field of ['trays','batteryAh','payloadKg']) number(design[field],`design.${field}`);
  if (!Number.isSafeInteger(design.trays)||Number(design.trays)<1||Number(design.trays)>MAX_TRAYS) invalid('design.trays');
  for (const field of ['batteryAh','payloadKg']) if (Number(design[field])<0||Number(design[field])>1000) invalid(`design.${field}`);
  const world=object(project.world,['id','revision','width','height','points','obstacles'],'world');
  text(world.id,'world.id');revision(world.revision,'world.revision');number(world.width,'world.width',true);number(world.height,'world.height',true);
  for (const field of ['width','height']) if (Number(world[field])>MAX_WORLD_SIZE) invalid(`world.${field}`);
  if (!Array.isArray(world.points)||!Array.isArray(world.obstacles)||world.points.length+world.obstacles.length>200) invalid('world.objects');
  const ids=new Set<string>();
  for (const value of world.points) {
    const point=object(value,['id','name','kind','x','y'],'world.point');
    text(point.id,'point.id');text(point.name,'point.name');number(point.x,'point.x');number(point.y,'point.y');
    if (!['table','kitchen','parking','dock'].includes(String(point.kind))) invalid('point.kind');
    if (ids.has(point.id as string)) invalid('world.duplicateId');
    ids.add(point.id as string);
  }
  for (const value of world.obstacles) {
    const obstacle=object(value,['id','x','y','width','height'],'world.obstacle');
    text(obstacle.id,'obstacle.id');number(obstacle.x,'obstacle.x');number(obstacle.y,'obstacle.y');number(obstacle.width,'obstacle.width',true);number(obstacle.height,'obstacle.height',true);
    if (ids.has(obstacle.id as string)) invalid('world.duplicateId');
    ids.add(obstacle.id as string);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length>MAX_PROJECT_BYTES) invalid('size');
  return structuredClone(value) as LabProject;
}
