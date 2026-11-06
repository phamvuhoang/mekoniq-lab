import {test,expect} from '@playwright/test';
import axe from 'axe-core';
declare global { interface Window { axe: typeof axe } }
for(const route of ['design','restaurant','scenarios','twin','results','deployment'])test(`accessible brand surface: ${route}`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#'+route);await page.evaluate(()=>document.fonts.ready);
 await page.addScriptTag({content:axe.source});
 const violations=await page.evaluate(async()=>{const result=await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});return result.violations.filter(v=>v.impact==='serious'||v.impact==='critical').map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));});
 expect(violations).toEqual([]);
});
test('compact heading controls retain touch targets',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#design');
 for(const button of await page.locator('.heading-actions button').all()){
  const box=await button.boundingBox();expect(box?.height).toBeGreaterThanOrEqual(44);expect(box?.width).toBeGreaterThanOrEqual(44);
 }
});
test('print captions and highlighted values use dark ink',async({page})=>{
 await page.goto('/#design');await page.emulateMedia({media:'print'});
 await expect(page.locator('.metric small').first()).toHaveCSS('color','rgb(20, 48, 52)');
 await expect(page.locator('.metric p').first()).toHaveCSS('color','rgb(20, 48, 52)');
 await expect(page.locator('.metric.cost strong')).toHaveCSS('color','rgb(20, 48, 52)');
});
