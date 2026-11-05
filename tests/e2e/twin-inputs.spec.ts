import {test,expect} from '@playwright/test';
const token=process.env.LAB_TEST_PAIRING_TOKEN;

test('UX05/UX18/QA09b: reset, speed-limit draft, saved report reopening and replay remain independent',async({page})=>{
 test.skip(!token,'Requires the real exported runtime launcher.');test.setTimeout(150000);
 await page.goto('/#twin');await page.getByRole('button',{name:'EN',exact:true}).click();await page.locator('#twin-pair-token').fill(token!);await page.getByRole('button',{name:'Pair runtime',exact:true}).click();
 await page.getByRole('button',{name:'One delivery order',exact:true}).click();await page.getByRole('button',{name:'2D',exact:true}).click();await page.getByRole('button',{name:'Run mock',exact:true}).click();
 const old=await page.getByTestId('run-id').textContent();await page.locator('#twin-run-speed').selectOption('64');await page.getByRole('button',{name:'Auto-run',exact:true}).click();await expect(page.getByTestId('run-status')).toContainText('Completed',{timeout:90000});
 await page.getByRole('button',{name:'Save immutable report',exact:true}).click();await expect(page.getByTestId('saved-evidence')).toContainText('inputs match');
 await page.locator('#twin-speed-limit').fill('0.2');await page.locator('#twin-speed-limit').blur();await expect(page.getByTestId('saved-evidence')).toContainText('stale evidence: profile');
 await page.getByRole('button',{name:'Reset (new run)',exact:true}).click();await expect(page.getByTestId('run-id')).not.toHaveText(old!);await expect(page.getByTestId('run-tick')).toContainText('0.0 s');await expect(page.getByTestId('run-status')).toContainText('Ready');
 // Reset keeps the original immutable inputs; only an explicit new-input run uses the draft limit.
 await page.getByRole('button',{name:'Run with edited inputs',exact:true}).click();const id=(await page.getByTestId('run-id').textContent())!.trim();
 const report=await page.evaluate(async id=>(await fetch(`/lab/v2/runs/${id}/report`)).json(),id);expect(report.manifest.configuration).toBeDefined();
 await page.getByTestId('saved-evidence').getByRole('button').filter({hasText:old!.trim().slice(0,8)}).first().click();await expect(page.getByTestId('replay-panel')).toBeVisible();await page.locator('#twin-replay-cursor').fill('0');await expect(page.getByTestId('run-served')).toContainText('0');
});
