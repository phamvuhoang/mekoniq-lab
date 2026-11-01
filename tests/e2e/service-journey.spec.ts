import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("paired source runtime drives arrival then human load and handoff", async ({
  page,
}) => {
  test.skip(
    !process.env.LAB_TEST_PAIRING_TOKEN,
    "Start pinned source runtime and supply its one-time token.",
  );
  await page.goto("/#scenarios");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.locator("#pair-token").fill(process.env.LAB_TEST_PAIRING_TOKEN!);
  await page.getByRole("button", { name: "Pair runtime", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create run", exact: true }),
  ).toBeEnabled();
  const create = page.waitForResponse(
    (r) => r.url().endsWith("/lab/v1/runs") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create run", exact: true }).click();
  const created = await create;
  expect(created.ok()).toBe(true);
  const run = await created.json();
  const invoke = async (action: string) => {
    const response = page.waitForResponse((r) =>
      r.url().endsWith(`/runs/${run.id}/actions`),
    );
    await page.locator(`[data-action="run-${action}"]`).click();
    const res = await response;
    expect(res.ok()).toBe(true);
    return res.json();
  };
  expect((await invoke("start")).served).toBe("0");
  let snap = await invoke("step");
  expect(snap.status).toBe("awaiting_load");
  expect(snap.served).toBe("0");
  snap = await invoke("confirm");
  expect(snap.loaded).toBe(true);
  snap = await invoke("step");
  expect(snap.status).toBe("awaiting_handoff");
  expect(snap.served).toBe("0");
  snap = await invoke("confirm");
  expect(snap.served).toBe("1");
  snap = await invoke("step");
  expect(snap.status).toBe("completed");
  await expect(page.locator(".run-state h3")).toHaveText("Completed");
  const recordedWorldRevision = await page
    .locator("#world-map")
    .getAttribute("data-world-revision");
  const recordedTablePosition = await page
    .locator('[data-world-point="table-1"]')
    .getAttribute("transform");
  const recordedRobotPosition = await page
    .locator("[data-robot-pose]")
    .getAttribute("transform");
  await page.getByRole("link", { name: "Restaurant", exact: true }).click();
  await expect(page.locator(".editor-run-notice")).toContainText(
    "Editing a draft",
  );
  await expect(page.locator("[data-robot-pose]")).toHaveCount(0);
  await page.locator("#world-object").selectOption("table-1");
  await page.locator('input[name="x"]').fill("3.2");
  await page
    .getByRole("button", { name: "Update coordinates", exact: true })
    .click();
  await expect(
    page.locator('[data-world-point="table-1"]'),
  ).not.toHaveAttribute("transform", recordedTablePosition!);
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  await expect(page.locator(".run-world-context")).toHaveAttribute(
    "data-stale",
    "true",
  );
  await expect(page.locator(".run-world-context")).toContainText(
    "Showing the recorded run layout",
  );
  await expect(page.locator("#world-map")).toHaveAttribute(
    "data-world-revision",
    recordedWorldRevision!,
  );
  await expect(page.locator('[data-world-point="table-1"]')).toHaveAttribute(
    "transform",
    recordedTablePosition!,
  );
  await expect(page.locator("[data-robot-pose]")).toHaveAttribute(
    "transform",
    recordedRobotPosition!,
  );
  await page.locator('a[href="#results"]').click();
  const report = page.waitForResponse((r) =>
    r.url().endsWith(`/runs/${run.id}/report`),
  );
  await page.locator('[data-action="report"]').click();
  const evidence = await (await report).json();
  expect(evidence.mode).toBe("business_sim");
  expect(evidence.coverage.nativeExecution).toBe(false);
  expect(
    evidence.events.some(
      (e: { type: string }) => e.type === "DeliveryHandedOff",
    ),
  ).toBe(true);
  expect(
    evidence.effects
      .filter((e: { type: string }) => e.type === "robot.execute")
      .reduce((n: number, e: { attempts: number }) => n + e.attempts, 0),
  ).toBe(3);
  await page.screenshot({
    path: "/tmp/mekoniq-lab-source-run.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Deployment", exact: true }).click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export draft candidate", exact: true })
    .click();
  const downloaded = await download;
  const bundle = JSON.parse(await readFile((await downloaded.path())!, "utf8"));
  expect(bundle.payload.evidenceRefs).toHaveLength(1);
  expect(bundle.payload.evidenceRefs[0]).toMatchObject({
    id: run.id,
    mode: "business_sim",
    trust: "unverified",
  });
  const bundleValidation = await page.evaluate(async (value) => {
    const modulePath = "/src/deployment/bundle.ts";
    const { validateBundle } = await import(modulePath);
    return validateBundle(value);
  }, bundle);
  expect(bundleValidation.ok).toBe(true);
  expect(JSON.stringify(bundle)).not.toContain("controlEpoch");
  expect(
    bundle.readiness.find((item: { id: string }) => item.id === "hardware")
      .status,
  ).toBe("blocked_external");
});
