import {expect,test} from 'vitest';
import {editSchedule,validateSchedule,type FaultScheduleEntry} from '../../src/scenarios/fault-schedule';
import {validateProjectV2} from '../../src/project/schema';
import fixture from '../../fixtures/twins/coffee-cell-v2.json';
const e:FaultScheduleEntry={id:'f1',faultId:'cup-removed',targetId:'coffee-1',trigger:{kind:'phase',value:'grasp'},durationMs:1000};
test('schedule export roundtrip preserves bounded typed entries without mutating locked project',()=>{
 const p=validateProjectV2(fixture.project),target=p.entities.find(t=>t.kind==='coffee_machine')!.id,updated=editSchedule(p,[{...e,targetId:target}]);
 expect(p.faultSchedule).toBeUndefined();expect(validateProjectV2(JSON.parse(JSON.stringify(updated))).faultSchedule).toEqual([{...e,targetId:target}]);
 for(const entries of [[e,e],[{...e,durationMs:Infinity}],[{...e,durationMs:60001}],[{...e,trigger:{kind:'phase',value:'shell'}}],[{...e,command:'rm'}]])expect(()=>validateSchedule(entries)).toThrow();
 expect(()=>editSchedule(p,[{...e,targetId:'arm-1'}])).toThrow('FAULT_TARGET_UNSUPPORTED');
});
