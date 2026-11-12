import {test,expect,type Page} from '@playwright/test';
import {openDisplayMenu,openInspector,openScenarioPicker} from '../support/twin';
// U01: the twin page is three fixed regions (run bar, viewport, transport bar) plus a details inspector closed by default. Against the mock
// launcher (scripts/test-mock-e2e.mjs twin-layout.spec.ts), preset coffee (BV01).
const token=process.env.LAB_TEST_PAIRING_TOKEN,shots=process.env.LAB_EVIDENCE_DIR;
const shot=async(page:Page,name:string)=>{if(shots)await page.screenshot({path:`${shots}/U01-${name}.png`});};
const LEVEL1=['scenario-picker','runtime-chip','mode-badge','run-status','run-tick','run-served','twin-scene','twin-transport'];
// where every existing data-testid now lives (spec §6.3); `ids` are element ids
const ROWS:{name:string;open:(page:Page)=>Promise<void>;container:string;testids:string[];ids?:string[]}[]=[
 {name:'display',open:openDisplayMenu,container:'[data-testid="display-menu"]',testids:['twin-legend','layer-provenance','layers-2d-only','navigation-scene-unavailable']},
 {name:'objects',open:p=>openInspector(p,'objects'),container:'#inspector-panel-objects',testids:['cycle-queue','entity-list','cup-owner','attention-reason']},
 {name:'engineering',open:p=>openInspector(p,'engineering'),container:'#inspector-panel-engineering',testids:['run-identity','run-id','run-revision','engineering-panel'],ids:['twin-fault']},
 {name:'report',open:p=>openInspector(p,'report'),container:'#inspector-panel-report',testids:['report-streams','saved-evidence','controller-verification'],ids:['twin-report-summary','twin-import-evidence']},
 {name:'setup',open:p=>openInspector(p,'setup'),container:'#inspector-panel-setup',testids:['preflight'],ids:['twin-backend-set','twin-fault-schedule','twin-speed-limit']},
];
const sel=(id:string)=>`[data-testid="${id}"]`;
/** Every instance of the row's items sits in its container; those present are visible once it is open. Conditional items (IR-SIM layers,
 * attention, …) may be absent on a mock run, but never anywhere else. */
async function rowReachable(page:Page,row:typeof ROWS[number]){
 await row.open(page);
 for(const s of [...row.testids.map(sel),...(row.ids??[]).map(i=>`#${i}`)]){
  const all=page.locator(s),inside=page.locator(row.container).locator(s),n=await all.count();
  expect(await inside.count(),`${row.name}: ${s} lives in ${row.container}`).toBe(n);
  for(let i=0;i<n;i++)await expect(inside.nth(i),`${row.name}: ${s}`).toBeVisible();
 }
}
const noVerticalScroll=(page:Page)=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight);
const sceneShare=(page:Page)=>page.evaluate(()=>{const r=document.querySelector('[data-testid="twin-scene"]')!.getBoundingClientRect();return r.width*r.height/(innerWidth*innerHeight);});
const inWindow=(page:Page,testid:string)=>page.evaluate(id=>{const r=document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.height>0;},testid);
/** The transport is on top at its own centre: nothing (the open inspector sheet) covers it. */
const uncovered=(page:Page,testid:string)=>page.evaluate(id=>{const t=document.querySelector(`[data-testid="${id}"]`)!,r=t.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return !!hit&&t.contains(hit);},testid);

test.describe.serial('viewport-first twin layout',()=>{
 test.skip(!token,'Run scripts/test-mock-e2e.mjs twin-layout.spec.ts: it starts the pinned source runtime and supplies its one-time token.');
 test.describe.configure({timeout:180000});
 let page:Page;
 test.beforeAll(async({browser})=>{page=await browser.newPage({viewport:{width:1440,height:900}});});
 test.afterAll(async()=>{await page.close();});

 test('first open: level 1 only, the inspector closed, no vertical scroll and a dominant viewport',async()=>{
  await page.goto('/#twin');
  await expect(page.getByTestId('twin-transport')).toBeVisible();
  await expect(page.getByTestId('twin-inspector')).toBeHidden();
  for(const id of LEVEL1)await expect(page.getByTestId(id),id).toBeVisible();
  await expect(page.getByTestId('problems-count')).toBeVisible();// not paired: preflight fails
  for(const row of ROWS)for(const s of [...row.testids.map(sel),...(row.ids??[]).map(i=>`#${i}`)])await expect(page.locator(s).first(),`${row.name}: ${s}`).toBeHidden();
  // not paired: the runtime box is open with the pairing form
  await expect(page.getByTestId('runtime-popover')).toBeVisible();
  for(const s of ['#twin-pair-form','#twin-pair-token'])await expect(page.getByTestId('runtime-popover').locator(s)).toBeVisible();
  expect(await noVerticalScroll(page)).toBe(true);
  expect(await sceneShare(page)).toBeGreaterThanOrEqual(0.6);
  await shot(page,'first-open-desktop-vi');
  await rowReachable(page,ROWS.find(r=>r.name==='setup')!);
  await shot(page,'setup-desktop-vi');// preflight is shown until a run starts
  expect(await noVerticalScroll(page)).toBe(true);
  expect(await sceneShare(page)).toBeGreaterThanOrEqual(0.45);
  await page.locator('[data-action="twin-inspector-toggle"]').click();
  await expect(page.getByTestId('twin-inspector')).toBeHidden();
 });

 test('every relocated item is reachable from its container during a run',async()=>{
  await page.locator('#twin-pair-token').fill(token!);
  await page.getByRole('button',{name:'Ghép nối runtime'}).click();
  await expect(page.getByTestId('runtime-popover')).toBeHidden();
  await openScenarioPicker(page);
  await page.getByRole('button',{name:'Cà phê sữa đá'}).click();
  await expect(page.locator('#twin-picker')).toBeHidden();
  await expect(page.getByTestId('primary-action')).toHaveText('Chạy mock');
  await expect(page.getByTestId('next-action')).toBeVisible();
  await page.getByTestId('primary-action').click();
  await expect(page.getByTestId('mode-badge')).toContainText('MOCK');
  await expect(page.getByTestId('run-status')).toContainText('Đang chạy');
  for(const s of ['twin-scene','twin-fallback-note','next-action'].map(sel))expect(await page.locator('.twin-viewport').locator(s).count(),s).toBe(await page.locator(s).count());
  for(const row of ROWS.filter(r=>r.name!=='setup')){await rowReachable(page,row);await shot(page,`${row.name}-desktop-vi`);}
  await page.getByTestId('runtime-chip').click();
  await expect(page.getByTestId('runtime-popover')).toBeVisible();
  await page.getByTestId('runtime-chip').click();
  await expect(page.getByTestId('runtime-popover')).toBeHidden();
 });

 test('a completed run still fits the window with the inspector closed and on every tab',async()=>{
  await page.locator('#twin-run-speed').selectOption('64');
  await page.getByTestId('twin-transport').getByRole('button',{name:'Tự chạy',exact:true}).click();
  await expect(page.getByTestId('run-status')).toContainText('Hoàn thành',{timeout:150000});
  await page.locator('[data-action="twin-inspector-toggle"]').click();
  await expect(page.getByTestId('twin-inspector')).toBeHidden();
  expect(await noVerticalScroll(page)).toBe(true);
  expect(await sceneShare(page)).toBeGreaterThanOrEqual(0.6);
  for(const tab of ['objects','engineering','report','setup'] as const){
   await openInspector(page,tab);
   expect(await noVerticalScroll(page),tab).toBe(true);
   expect(await sceneShare(page),tab).toBeGreaterThanOrEqual(0.45);
   await shot(page,`completed-${tab}-desktop-vi`);
  }
 });

 test('the chosen tab survives a reload',async()=>{
  await openInspector(page,'engineering');
  await page.reload();
  await expect(page.getByTestId('twin-inspector')).toBeVisible();
  await expect(page.getByTestId('inspector-tab-engineering')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#inspector-panel-engineering')).toBeVisible();
 });

 test('phone: the transport stays in view and the inspector sheet never covers it',async()=>{
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="twin-inspector-toggle"]').click();
  await expect(page.getByTestId('twin-inspector')).toBeHidden();
  expect(await inWindow(page,'twin-transport')).toBe(true);
  await openInspector(page,'objects');
  expect(await inWindow(page,'twin-transport')).toBe(true);
  expect(await uncovered(page,'twin-transport')).toBe(true);
  await shot(page,'objects-phone-vi');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 });

 test('low screen: the page scrolls and the transport sticks to the bottom',async()=>{
  await page.setViewportSize({width:1280,height:640});
  await page.locator('[data-action="twin-inspector-toggle"]').click();
  await expect(page.getByTestId('twin-inspector')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight)).toBe(true);
  expect(await inWindow(page,'twin-transport')).toBe(true);
  await shot(page,'low-screen');
  await page.evaluate(()=>scrollTo(0,0));
  expect(await inWindow(page,'twin-transport')).toBe(true);
 });
});
