import {expect,type Page} from '@playwright/test';
import type {InspectorTab} from '../../src/ui/inspector';
// Containers of the Digital twin page (U01): open one before acting on, or asserting the visibility of, something inside it. Idempotent.
export async function openInspector(page:Page,tab:InspectorTab):Promise<void>{
 if(!await page.getByTestId('twin-inspector').isVisible())await page.locator('[data-action="twin-inspector-toggle"]').click();
 const t=page.getByTestId(`inspector-tab-${tab}`);
 if(await t.getAttribute('aria-selected')!=='true')await t.click();
 await expect(page.locator(`#inspector-panel-${tab}`)).toBeVisible();
}
export async function openDisplayMenu(page:Page):Promise<void>{
 if(!await page.getByTestId('display-menu').isVisible())await page.locator('[data-action="twin-display-toggle"]').click();
 await expect(page.getByTestId('display-menu')).toBeVisible();
}
/** The scenario picker (U02): one button per preset, runnable ones first. */
export async function openScenarioPicker(page:Page):Promise<void>{
 if(!await page.locator('#twin-picker').isVisible())await page.getByTestId('scenario-picker').click();
 await expect(page.locator('#twin-picker')).toBeVisible();
}
/** The problems list (U02) opens from the run bar's count, which exists only while there is a problem. */
export async function openProblems(page:Page):Promise<void>{
 if(!await page.getByTestId('problems-panel').isVisible())await page.getByTestId('problems-count').click();
 await expect(page.getByTestId('problems-panel')).toBeVisible();
}
