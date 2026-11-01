export type Locale = 'vi' | 'ja' | 'en';
export interface RobotDesign { id:string; revision:number; chassis:'service'|'valetudo'; trays:number; batteryAh:number; sensor:'lidar'|'depth'; payloadKg:number; }
export interface WorldPoint {id:string;name:string;kind:'table'|'kitchen'|'parking'|'dock';x:number;y:number;}
export interface Obstacle {id:string;x:number;y:number;width:number;height:number;}
export interface RestaurantWorld {id:string;revision:number;width:number;height:number;points:WorldPoint[];obstacles:Obstacle[];}
export interface LabProject {schemaVersion:1;id:string;name:string;revision:number;updatedAt:string;design:RobotDesign;world:RestaurantWorld;}
export interface Issue {code:string;field:string;message:string;}
export interface BomLine {id:string;name:string;quantity:number;massKg:number;priceMinor:string|null;currency:'VND';provenance:'illustrative';}
export interface DesignSummary {lines:BomLine[];totalMinor:string|null;missingIds:string[];massKg:number|null;usableWh:number|null;runtimeHours:number|null;issues:Issue[];}
export type RunStatus='ready'|'running'|'awaiting_load'|'awaiting_handoff'|'completed'|'cancelled'|'needs_attention';
export interface RunEvent {type:string;at:string;[key:string]:unknown;}
export interface RunSnapshot {id:string;mode:'business_sim';status:RunStatus;stage:'idle'|'to_kitchen'|'load'|'to_table'|'handoff'|'to_parking'|'finished';revision:number;robotPosition:{x:number;y:number};target:{x:number;y:number}|null;served:string;loaded:boolean;events:RunEvent[];elapsedMs:number;sourceCommit:string;scenarioId:string;seed:number;[key:string]:unknown;}
