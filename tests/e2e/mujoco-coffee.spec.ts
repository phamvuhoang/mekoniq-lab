// INT15 (U06): MJ-BV01 against the real pinned runtime and the real MuJoCo worker, from the Lab UI (scripts/test-irsim-e2e.mjs --provider mujoco tests/e2e/mujoco-coffee.spec.ts).
// The runtime box in its three states, pairing through it, the mujoco-coffee preset at 1× for 10 s (with one real pointer Pause/Resume), then 16× to completed;
// the 3D view draws the xArm 6 from its meshes and the plant's cups without rebuilding the scene, the joints read thực (MuJoCo) / lệnh, and the report carries
// the plant block. Ignored by the default Playwright config; without the launcher's pairing code it FAILS (never skipped). Screenshots are candidate evidence only.
import {test,expect,type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {openInspector,openScenarioPicker} from '../support/twin';
const token=process.env.LAB_TEST_PAIRING_TOKEN,dir=process.env.LAB_EVIDENCE_DIR??process.env.LAB_IRSIM_SCREENSHOTS;
const shot=async(page:Page,name:string)=>{if(dir)await page.screenshot({path:`${dir}/U06-${name}.png`});};
const simS=async(page:Page)=>Number(((await page.getByTestId('run-tick').locator('b').textContent())??'').replace(',','.').replace(/[^\d.]/g,''));
interface Report {outcome:{status:string;served:string;tick:number};coverage:Record<string,boolean>;manifest:{scenario:{id:string};backends:{id:string}[]};
 arm?:{armPlant:{engine:string;grip:string;calibration:string};collision:{result:string};waypoints?:{table:unknown[]};releaseTimeoutTicks?:number};coffee?:{armTrace:{stop:unknown}}}

test('MJ-BV01 from the Lab UI: runtime box, mujoco-coffee at 1× then 16× to completed, the mesh arm and cups, both joint columns and the plant report',async({browser})=>{
 expect(token,'Run scripts/test-irsim-e2e.mjs --provider mujoco tests/e2e/mujoco-coffee.spec.ts: it starts lab:mujoco with the real MuJoCo worker and supplies the one-use pairing code').toBeTruthy();
 test.setTimeout(900000);
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
 const box=page.getByTestId('runtime-popover'),url=page.locator('#twin-runtime-url');
 await page.goto('/#twin');
 // 1. this machine: chosen by default, the pinned commit and the runtime's (the page's own runtime answered the automatic probe) are shown
 await expect(box).toBeVisible();await expect(page.locator('#twin-runtime-here')).toBeChecked();
 await expect(box.getByTestId('runtime-pin-commit')).not.toHaveText('—');await expect(box.getByTestId('runtime-commit')).toHaveText(await box.getByTestId('runtime-pin-commit').textContent()??'');
 await shot(page,'box-this-machine');
 // 2. another address whose runtime runs another commit: both commits, runs blocked (a route stands in for that runtime)
 await page.route('https://rt.example/**',r=>r.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:4175'},body:JSON.stringify({protocolMajors:[2],sourceCommit:'b'.repeat(40),schemaHash:'s',scenarioIds:[],backends:[],backendSets:[],features:{bearer:true,pacedStep:true}})}));
 await page.locator('label',{hasText:'Địa chỉ khác'}).click();await url.fill('https://rt.example');await expect(page.locator('#twin-runtime-other')).toBeChecked();
 await page.locator('#twin-pair-token').fill('not-used');await page.getByRole('button',{name:'Ghép nối runtime'}).click();
 await expect(box.getByTestId('runtime-pin-mismatch')).toContainText('bbbbbbb');await expect(box.getByTestId('runtime-pin-mismatch')).toContainText((await box.getByTestId('runtime-pin-commit').textContent())!);
 await shot(page,'box-pin-mismatch');
 // 3. a loopback address the browser cannot reach: the box says what to do
 await url.fill('http://127.0.0.1:4179');await page.locator('#twin-pair-token').fill('not-used');await page.getByRole('button',{name:'Ghép nối runtime'}).click();
 await expect(box.getByTestId('runtime-error')).toContainText('LOOPBACK_BLOCKED');await expect(box.getByTestId('runtime-error')).toContainText('Trình duyệt chặn kết nối tới 127.0.0.1 từ trang này');
 await shot(page,'box-loopback-blocked');
 // back to this machine, then pair with the launcher's code
 await page.locator('label',{hasText:'Máy này'}).click();await expect(url).toHaveValue('');
 await page.locator('#twin-pair-token').fill(token!);await page.getByRole('button',{name:'Ghép nối runtime'}).click();
 await expect(box).toBeHidden();

 await openScenarioPicker(page);await page.getByRole('button',{name:'MuJoCo · cà phê với tay máy xArm 6'}).click();
 await expect(page.locator('#twin-run-speed')).toHaveValue('1');// the preset starts at 1×
 const primary=page.getByTestId('primary-action');
 await expect(primary).toHaveText('Chạy MuJoCo (tay máy)',{timeout:180000});await expect(primary).toBeEnabled();
 await primary.click();
 await expect(page.getByTestId('mode-badge')).toContainText('SIMULATION');await expect(page.getByTestId('mode-badge')).toContainText('chưa hiệu chuẩn');
 await openInspector(page,'engineering');await expect(page.getByTestId('run-identity')).toContainText('MJ-BV01');

 // the arm is drawn from its meshes once its first sample arrives
 const canvas=page.locator('#twin-stage canvas'),ds=(k:string)=>canvas.evaluate((c,key)=>(c as HTMLCanvasElement).dataset[key]??'',k);
 await expect.poll(()=>ds('armModel'),{timeout:60000}).toBe('mesh');expect(await ds('armMeshLinks')).toBe('14');expect(await ds('armFallback')).toBe('');
 // both joint columns, labelled
 await openInspector(page,'objects');await page.getByTestId('entity-list').getByRole('button',{name:/Cánh tay 1/}).click();
 await openInspector(page,'engineering');
 const q1=page.getByTestId('eng-joint-1');await expect(q1.locator('dd').nth(0)).toContainText(/-?\d/);await expect(q1.locator('dd').nth(1)).toContainText(/-?\d/);
 await expect(page.getByTestId('eng-arm-source')).toContainText('thực (MuJoCo) · lệnh');
 await shot(page,'engineering-joints');

 // paced steps as the browser sees them: how long each took against its due time (20 ticks x 20 ms / factor)
 const steps:{factor:number;ms:number}[]=[];
 page.on('requestfinished',r=>{if(r.method()!=='POST'||!r.url().endsWith('/actions'))return;const b=r.postDataJSON() as {kind?:string;payload?:{pace?:{factor:number}}};if(b?.kind==='step'&&b.payload?.pace)steps.push({factor:b.payload.pace.factor,ms:r.timing().responseEnd});});
 const T=page.locator('#twin-transport'),btn=(a:string)=>T.locator(`[data-action="${a}"]`),status=page.getByTestId('run-status');
 const rebuilds0=await ds('rebuilds'),redraws0=await ds('redraws');
 const remember=()=>page.evaluate(()=>{(window as unknown as {kept:Element[]}).kept=[...document.querySelectorAll('#twin-transport button,#twin-run-speed,#twin-details [role="tab"],#twin-runtime-box button')];return (window as unknown as {kept:Element[]}).kept.length;});
 const allKept=()=>page.evaluate(()=>(window as unknown as {kept:Element[]}).kept.every(n=>n.isConnected));

 // 1× for 10 s
 const started=Date.now();
 await btn('twin-play').click();await expect(btn('twin-stop')).toBeVisible();
 const s0=await simS(page),w0=Date.now();expect(await remember()).toBeGreaterThan(8);
 await page.waitForTimeout(10000);
 const s1=await simS(page),w1=Date.now(),measured=(s1-s0)/((w1-w0)/1000);
 expect(await allKept(),'controls kept their elements at 1×').toBe(true);
 expect(measured,'1× runs at about real time').toBeGreaterThan(0.5);expect(measured).toBeLessThan(1.25);
 expect(await ds('plantCupsDropped')).toBe('0');
 // Pause with one real pointer click, then Resume
 await btn('twin-pause').click();await expect(status).toContainText('Tạm dừng');
 await btn('twin-resume').click();await expect(status).toContainText('Đang chạy');
 // on at 1× until the plant closes the gripper on a cup (the 3D view follows the plant)
 await btn('twin-play').click();await expect(btn('twin-stop')).toBeVisible();
 await expect.poll(async()=>Math.abs(Number(await ds('gripperRad'))),{timeout:120000,intervals:[200]}).toBeGreaterThan(0.01);
 const holding=JSON.parse(await ds('cups')||'{}') as Record<string,number[]>;
 await shot(page,'mujoco-1x-holding');
 // then 16× to completed
 await page.locator('#twin-run-speed').selectOption('16');
 await expect(status).toContainText('Hoàn thành',{timeout:600000});
 const total=(Date.now()-started)/1000;
 await expect(page.getByTestId('report-pending')).toHaveCount(0,{timeout:60000});
 const rebuilds1=await ds('rebuilds'),redraws1=await ds('redraws');
 await expect(page.getByTestId('run-served')).toContainText('2');
 await expect(page.getByTestId('problems-count')).toHaveCount(0);await expect(page.getByTestId('notes-count')).toHaveCount(0);
 expect(await ds('armModel')).toBe('mesh');expect(await ds('armFallback')).toBe('');expect(await ds('plantCupsDropped')).toBe('0');
 expect(rebuilds1,'the scene was not rebuilt while the run went on').toBe(rebuilds0);

 // the completed run with the details closed (the brief's screens/mujoco-coffee.png)
 await page.locator('[data-action="twin-inspector-toggle"]').click();await expect(page.getByTestId('twin-inspector')).toBeHidden();
 if(dir){mkdirSync(`${dir}/screens`,{recursive:true});await page.screenshot({path:`${dir}/screens/mujoco-coffee.png`});}

 // the report tab: the plant block
 await openInspector(page,'report');
 const plant=page.getByTestId('arm-plant');
 await expect(plant).toContainText('not_calibrated');await expect(plant).toContainText('contact');await expect(plant).toContainText('mujoco_3d');
 expect(await plant.getByTestId('arm-waypoints').locator('tbody tr').count()).toBeGreaterThan(0);
 await expect(plant.getByTestId('arm-allowed-contacts')).toContainText('toàn bộ vệt');await expect(plant.getByTestId('arm-release-timeout')).toContainText('giả định');
 await expect(plant.getByTestId('arm-scene-coverage')).toHaveAttribute('data-value','true');await expect(plant.getByTestId('arm-stop')).toHaveCount(0);
 await plant.scrollIntoViewIfNeeded();await shot(page,'report-plant');

 const id=(await page.evaluate(()=>document.querySelector('[data-testid="run-id"]')?.textContent??'')).trim();
 const r=await page.evaluate(async x=>(await fetch(`/lab/v2/runs/${x}/report`,{credentials:'same-origin'})).json(),id) as Report;
 expect(r.manifest.scenario.id).toBe('MJ-BV01');expect(r.manifest.backends.map(b=>b.id)).toContain('mujoco_arm');
 expect(r.outcome).toMatchObject({status:'completed',served:'2'});
 expect(r.arm).toMatchObject({armPlant:{engine:'mujoco_3d',grip:'contact',calibration:'not_calibrated'},collision:{result:'pass'}});
 expect(r.coverage.armSceneCollision,'the docked robot was in the arm\'s collision check').toBe(true);
 const late=steps.filter(s=>s.ms>20*20/s.factor+250);
 console.log(`MJ-BV01 ${JSON.stringify({measured1x:Number(measured.toFixed(3)),simS:[s0,s1],wallS:(w1-w0)/1000,totalWallS:Number(total.toFixed(1)),finalTick:r.outcome.tick,
  steps:steps.length,maxStepMs:{1:Math.max(0,...steps.filter(s=>s.factor===1).map(s=>Math.round(s.ms))),16:Math.max(0,...steps.filter(s=>s.factor===16).map(s=>Math.round(s.ms)))},late:late.length,rebuilds:[rebuilds0,rebuilds1],redraws:[redraws0,redraws1],cupsWhileHolding:holding})}`);
 await context.close();
});
