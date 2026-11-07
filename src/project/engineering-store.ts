import type {EngineeringProject} from '../shared/engineering';

const freeze=<T>(value:T):T=>{
  if (value&&typeof value==='object'&&!Object.isFrozen(value)) {Object.freeze(value);for (const child of Object.values(value as object)) freeze(child);}
  return value;
};
/**
 * The one editable engineering design that Designer, layout and Twin all read. Reads are deep-frozen copies and the live run keeps its own
 * snapshot, so editing the draft can never change a run in progress. Undo and redo are edits too: each makes a new, higher revision.
 */
export class EngineeringProjectStore {
  private project:EngineeringProject;
  private readonly past:EngineeringProject[]=[];
  private future:EngineeringProject[]=[];
  private readonly listeners=new Set<()=>void>();
  constructor(project:EngineeringProject) {this.project=structuredClone(project);}
  /** A private copy the caller may mutate and hand back to replaceDraft. */
  getDraft():EngineeringProject {return structuredClone(this.project);}
  snapshot():EngineeringProject {return freeze(structuredClone(this.project));}
  private commit(next:EngineeringProject):void {
    this.project={...structuredClone(next),revision:this.project.revision+1};
    for (const listener of [...this.listeners]) listener();
  }
  replaceDraft(project:EngineeringProject):void {
    this.past.push(this.project);this.future=[];
    this.commit(project);
  }
  /** Opens a stored or imported project exactly as it is: same revision, same digest. The previous design stays one undo away. */
  load(project:EngineeringProject):void {
    this.past.push(this.project);this.future=[];
    this.project=structuredClone(project);
    for (const listener of [...this.listeners]) listener();
  }
  /** Start-up restore: the stored project becomes the baseline with no earlier history. */
  reset(project:EngineeringProject):void {
    this.past.length=0;this.future=[];
    this.project=structuredClone(project);
    for (const listener of [...this.listeners]) listener();
  }
  undo():boolean {
    const previous=this.past.pop();
    if (!previous) return false;
    this.future.push(this.project);this.commit(previous);return true;
  }
  redo():boolean {
    const next=this.future.pop();
    if (!next) return false;
    this.past.push(this.project);this.commit(next);return true;
  }
  subscribe(listener:()=>void):()=>void {this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
}
