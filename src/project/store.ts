import type {LabProject} from '../shared/types';
import {MAX_PROJECT_BYTES,validateProject} from './schema';

/** IndexedDB transaction completion, rather than request success, defines a saved project. */
export class ProjectStore {
  private connection:Promise<IDBDatabase>|null=null;
  constructor(private readonly databaseName='mekoniq-robot-lab') {}
  private database():Promise<IDBDatabase> {
    if (!this.connection) {
      this.connection=new Promise((resolve,reject)=>{
        const request=indexedDB.open(this.databaseName,1);
        request.onupgradeneeded=()=>{if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects',{keyPath:'id'});};
        request.onerror=()=>reject(request.error??new Error('DATABASE_OPEN_FAILED'));
        request.onblocked=()=>reject(new Error('DATABASE_UPGRADE_BLOCKED'));
        request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();this.connection=null;};resolve(request.result);};
      });
    }
    return this.connection;
  }
  async save(project:LabProject):Promise<void> {
    const checked=validateProject(project);
    const database=await this.database();
    await new Promise<void>((resolve,reject)=>{
      const transaction=database.transaction('projects','readwrite');
      transaction.oncomplete=()=>resolve();
      transaction.onabort=()=>reject(transaction.error??new Error('PROJECT_SAVE_ABORTED'));
      transaction.onerror=()=>reject(transaction.error??new Error('PROJECT_SAVE_FAILED'));
      transaction.objectStore('projects').put(checked);
    });
  }
  async load(id:string):Promise<LabProject|null> {
    const database=await this.database();
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction('projects','readonly');
      const request=transaction.objectStore('projects').get(id);
      request.onsuccess=()=>{try {resolve(request.result===undefined ? null : validateProject(request.result));} catch(error) {reject(error);}};
      request.onerror=()=>reject(request.error??new Error('PROJECT_LOAD_FAILED'));
    });
  }
  async export(id:string):Promise<string> {
    const project=await this.load(id);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    return JSON.stringify(project,null,2);
  }
  async import(json:string):Promise<LabProject> {
    if (new TextEncoder().encode(json).length>MAX_PROJECT_BYTES) throw new Error('PROJECT_TOO_LARGE');
    const project=validateProject(JSON.parse(json));
    await this.save(project);
    return project;
  }
  async close():Promise<void> {
    if (this.connection) (await this.connection).close();
    this.connection=null;
  }
}
