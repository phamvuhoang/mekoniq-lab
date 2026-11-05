import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import type {RunReport,RunView} from '../../src/scenarios/controls';
const token=process.env.LAB_TEST_PAIRING_TOKEN;
const normalize=(report:RunReport)=>{
 const ids=new Map<string,string>(),norm=(value:unknown):unknown=>typeof value==='string'?value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,id=>{const key=id.toLowerCase();if(!ids.has(key))ids.set(key,`uuid#${ids.size+1}`);return ids.get(key)!;}):Array.isArray(value)?value.map(norm):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,norm(v)])):value;
 return norm({served:report.outcome.served,status:report.outcome.status,events:report.businessEvents,effects:report.effects,metrics:report.metrics});
};
// Rendering is an explicit read-only consumer. The runner receives the same fixed steps while view cadence and browser lifecycle vary.
test('SYS01: normalized journal/effects are identical at 15/60 FPS and while the browser renderer is frozen',async({page,context})=>{
 test.skip(!token,'Requires the real exported runtime launcher.');test.setTimeout(180000);
 await page.goto('/#twin');await page.getByRole('button',{name:'EN',exact:true}).click();await page.locator('#twin-pair-token').fill(token!);
 const paired=page.waitForResponse(r=>r.url().endsWith('/lab/v2/sessions')&&r.request().method()==='POST');await page.getByRole('button',{name:'Pair runtime',exact:true}).click();const {csrfToken}=await (await paired).json();
 const health=await (await context.request.get('/lab/v2/health')).json(),fixture=await (await context.request.get('/fixtures/twins/restaurant-v2.json')).json();
 const headers={'X-CSRF-Token':csrfToken,Origin:'http://127.0.0.1:4175'},reports:RunReport[]=[],measurements:unknown[]=[];
 const cdp=await context.newCDPSession(page);
 for(const variant of [{fps:15,speed:4,frozen:false},{fps:60,speed:64,frozen:false},{fps:60,speed:64,frozen:true}]){
  const created=await context.request.post('/lab/v2/runs',{headers,data:{project:fixture.project,scenarioId:'FD01',scenarioRevision:1,seed:42,mode:'mock',backendSetId:'mock-amr',access:'simulated',runtimeIdentity:{sourceCommit:health.sourceCommit,schemaHash:health.schemaHash}}});expect(created.ok()).toBe(true);let view=await created.json() as RunView;
  await page.evaluate(async({view,fps})=>{
   const scenePath='/src/twin/scene.ts',layersPath='/src/twin/overlays.ts',catalogPath='/src/scenarios/catalog.ts';
   const {renderTwin}=await import(scenePath),{defaultLayers}=await import(layersPath),{presetById}=await import(catalogPath);
   document.body.innerHTML='<div id="sys01-stage"></div>';const state={view,draws:0,last:0,active:true},frame={preset:presetById('delivery'),report:null};
   const draw=(now:number)=>{if(!state.active)return;if(now-state.last>=1000/fps){document.getElementById('sys01-stage')!.innerHTML=renderTwin({...frame,view:state.view},{view:'2d',layers:defaultLayers(),selected:null});state.last=now;state.draws++;}requestAnimationFrame(draw);};requestAnimationFrame(draw);(window as unknown as {sys01:typeof state}).sys01=state;
  },{view,fps:variant.fps});
  if(variant.frozen)await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
  const action=async(kind:string,payload:Record<string,unknown>={})=>{const r=await context.request.post(`/lab/v2/runs/${view.run.id}/actions`,{headers,data:{actionId:crypto.randomUUID(),expectedRevision:view.run.runRevision,kind,payload}});expect(r.ok()).toBe(true);view=await r.json() as RunView;};
  await action('start');const start=Date.now();let steps=0;
  while(view.run.status!=='completed'&&steps++<400){await action('step',{ticks:25});if(!variant.frozen)await page.evaluate(view=>{(window as unknown as {sys01:{view:RunView}}).sys01.view=view;},view);await new Promise(r=>setTimeout(r,500/variant.speed));}
  expect(view.run.status).toBe('completed');expect(view.served).toBe('1');
  if(variant.frozen)await cdp.send('Page.setWebLifecycleState',{state:'active'});
  const draws=await page.evaluate(()=>{const state=(window as unknown as {sys01:{active:boolean;draws:number}}).sys01;state.active=false;return state.draws;});
  reports.push(await (await context.request.get(`/lab/v2/runs/${view.run.id}/report`)).json());measurements.push({...variant,wallMs:Date.now()-start,steps,draws,lifecycle:variant.frozen?'Chrome Page frozen while source continued stepping':'active'});
  expect((await context.request.post(`/lab/v2/runs/${view.run.id}/archive`,{headers,data:{}})).ok()).toBe(true);
 }
 expect(normalize(reports[1]!)).toEqual(normalize(reports[0]!));expect(normalize(reports[2]!)).toEqual(normalize(reports[0]!));
 if(process.env.LAB_EVIDENCE_DIR)await writeFile(`${process.env.LAB_EVIDENCE_DIR}/plan01-render-independence.json`,JSON.stringify({capturedAt:new Date().toISOString(),sourceCommit:health.sourceCommit,measurements,identical:true,note:'Chrome frozen lifecycle is a real suspended renderer, not a synthetic visibility property. No claim of a particular OS background-tab throttling policy.'},null,2)+'\n');
});
