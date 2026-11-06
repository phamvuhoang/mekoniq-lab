import {expect,test,vi} from 'vitest';
vi.mock('../../src/i18n',()=>({tr:(vi:string)=>vi}));
import {preflight} from '../../src/scenarios/preflight';
import {presetById} from '../../src/scenarios/catalog';
import {requestForPreset,type TwinHealth} from '../../src/scenarios/controls';
test('explicit native preset keeps simulation mode and requires matching runtime readiness',()=>{
 const p={...presetById('coffee')!,mode:'simulation' as const,backendSetId:'coffee-simulation'};
 expect(requestForPreset(p)).toMatchObject({mode:'simulation',backendSetId:'coffee-simulation',access:'simulated'});
 const health:TwinHealth={protocolMajors:[2],sourceCommit:'x',schemaHash:'s',scenarioIds:['BV01'],backends:[],backendSets:[{id:'coffee-simulation',mode:'simulation',access:'simulated',backends:[]}],features:{readiness:true}};
 expect(preflight(p,health,true).find(c=>c.id==='backend')?.ok).toBe(true);expect(preflight(p,health,true).find(c=>c.id==='readiness')?.ok).toBe(false);
 expect(preflight({...p,mode:'mock'},health,true).find(c=>c.id==='backend')?.ok).toBe(false);
});
