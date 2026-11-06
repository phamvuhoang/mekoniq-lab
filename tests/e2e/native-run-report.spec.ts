import fixture from '../../fixtures/twins/native-bv01-v2.json';
import type {RunView,RunReport} from '../../src/scenarios/controls';
import {expect,test} from '@playwright/test';
// Execution is not_run without an operator-provided native environment and pairing token.
// Run: LAB_NATIVE_BASE_URL=http://127.0.0.1:4175 LAB_NATIVE_PAIRING_TOKEN=... pnpm exec playwright test -c playwright.native.config.ts
const token=process.env.LAB_NATIVE_PAIRING_TOKEN;
test.skip(!token||!process.env.LAB_NATIVE_BASE_URL,'not_run: NATIVE_PROVIDER_ENVIRONMENT_UNAVAILABLE');
test('one authenticated native BV01 run carries actual engine evidence into the report',async({page})=>{
 await page.goto('/#twin');await page.locator('[data-action="twin-preset"][data-value="native-bv01"]').click();
 const health=await page.request.get('/lab/v2/health');expect(health.ok()).toBe(true);const h=await health.json();
 for(const id of ['gazebo_nav2','linuxcnc_sim','coffee_io_sim'])expect(h.backends.find((b:{id:string})=>b.id===id)).toMatchObject({enabled:true});
 // Browser origin pairing and action requests use the same session and CSRF boundary as the UI.
 const result=await page.evaluate(async ({token,project})=>{
  let csrf='';const request=async(path:string,body?:unknown)=>{const r=await fetch('/lab/v2'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json',...csrf?{'X-CSRF-Token':csrf}:{}},...body===undefined?{}:{body:JSON.stringify(body)}});const result=await r.json();if(!r.ok)throw new Error(JSON.stringify(result));return result;};
  csrf=(await request('/sessions',{token})).csrfToken;const h=await request('/health');
  const readiness=await request('/readiness',{scenarioId:'BV01',backendSetId:'coffee-simulation',project});if(!readiness.canStart)throw new Error(JSON.stringify(readiness.checks));
  let v=await request('/runs',{project,scenarioId:'BV01',scenarioRevision:1,seed:23,mode:'simulation',access:'simulated',backendSetId:'coffee-simulation',runtimeIdentity:{sourceCommit:h.sourceCommit,schemaHash:h.schemaHash}});
  v=await request(`/runs/${v.run.id}/actions`,{actionId:crypto.randomUUID(),expectedRevision:v.run.runRevision,kind:'start',payload:{}});
  const end=Date.now()+200000;while(v.run.status==='running'&&Date.now()<end){await new Promise(r=>setTimeout(r,250));v=await request(`/runs/${v.run.id}`);}
  return {view:v,report:await request(`/runs/${v.run.id}/report`)};
 },{token:token!,project:fixture.project}) as {view:RunView;report:RunReport};
 expect(result.report.manifest.mode).toBe('simulation');expect(result.report.manifest.runId).toBe(result.view.run.id);expect(result.report.outcome).toMatchObject({status:'completed',served:'2'});
 expect(result.report.verification).toMatchObject({execution:'ran',result:'pass',blockers:[]});expect(result.report.verification?.arm?.result).toBe('pass');expect(result.report.verification?.armTickMap?.length).toBeGreaterThan(1);
 expect(result.report.coffee?.armTrace.samples).toEqual([]);expect(result.report.telemetry?.samples.some(s=>s.providerId==='gazebo_nav2')).toBe(true);expect(result.report.telemetry?.samples.some(s=>s.providerId==='linuxcnc_sim')).toBe(true);
});
