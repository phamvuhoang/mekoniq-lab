import { test, expect } from "@playwright/test";

test("shell preserves identity, defaults to Vietnamese and offers all screens", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "vi");
  await expect(page.locator(".brand-mark i")).toHaveCount(3);
  await expect(page.locator(".mode-badge")).toContainText("PREVIEW");
  await expect(
    page.getByRole("link", { name: "Kế hoạch kinh doanh" }),
  ).toHaveAttribute("href", "/business-plan.html");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your robot, down to the details." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Results" }).click();
  await expect(
    page.getByRole("heading", { name: "No run evidence yet" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Deployment" }).click();
  await expect(
    page.getByRole("button", { name: "Deploy to robot · blocked" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "JA", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});

test("configurator links parts, changes estimates and persists with undo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "2 trays", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "2 trays", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator('.bom-row[data-value="lidar"]').click();
  await expect(page.locator(".selected-part h3")).toHaveText("LiDAR 360°");
  await page.locator("#explode").fill("0.75");
  await expect(page.locator(".assembly-control output")).toHaveText("75%");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator(".robot-fallback")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "2 trays", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "4 trays", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "2 trays", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("world-editor supports coordinate entry and draft export", async ({
  page,
}) => {
  await page.goto("/#restaurant");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.locator("#world-object").selectOption("table-1");
  await page.locator('input[name="x"]').fill("4.2");
  await page.getByRole("button", { name: "Update coordinates" }).click();
  await expect(page.locator('input[name="x"]')).toHaveValue("4.2");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('input[name="x"]')).toHaveValue("3");
  await page.getByRole("link", { name: "Deployment" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export draft candidate" }).click();
  expect((await download).suggestedFilename()).toBe(
    "mekoniq-deployment-draft.json",
  );
});

test("mobile and reduced-motion fallback remain accessible without horizontal overflow", async ({
  page,
}) => {
  const viewerRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/src\/viewer\/robot\.ts|\/three(?:\.|\/)/.test(request.url()))
      viewerRequests.push(request.url());
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?mode=hardware_test");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator(".robot-fallback")).toBeVisible();
  expect(viewerRequests).toEqual([]);
  for (const name of [
    "Design",
    "Restaurant",
    "Scenarios",
    "Results",
    "Deployment",
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Scenarios", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create run", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("#pair-token")).toBeVisible();
  await page.screenshot({
    path: "/tmp/mekoniq-lab-mobile.png",
    fullPage: true,
  });
});

test("desktop workshop screenshot and WebGL context loss retain configuration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1512, height: 1100 });
  await page.addInitScript(`
    window.labDetachedCanvases = 0;
    const append = Node.prototype.appendChild;
    Node.prototype.appendChild = function(node) {
      if (node instanceof HTMLCanvasElement && !this.isConnected) window.labDetachedCanvases++;
      return append.call(this,node);
    };
  `);
  let releaseImport!: () => void;
  const importGate = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  await page.route("**/src/viewer/robot.ts*", async (route) => {
    await importGate;
    await route.continue();
  });
  const requested = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/src/viewer/robot.ts",
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await requested;
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("link", { name: "Results", exact: true }).click();
  releaseImport();
  await expect(
    page.getByRole("heading", { name: "No run evidence yet" }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByRole("link", { name: "Design", exact: true }).click();
  await expect(page.locator("#robot-stage canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "4 trays", exact: true }).click();
  await expect(page.locator("#robot-stage canvas")).toHaveCount(1);
  expect(
    await page.evaluate(() => Reflect.get(window, "labDetachedCanvases")),
  ).toBe(0);
  await page.screenshot({
    path: "/tmp/mekoniq-lab-desktop.png",
    fullPage: true,
  });
  await page
    .locator("#robot-stage canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(page.locator(".robot-fallback")).toBeVisible();
  await expect(page.locator("#chassis")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Export project" }),
  ).toBeEnabled();
});

test("all three locales fit tablet and desktop, with explicit unmeasured Valetudo values", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  for (const language of ["VI", "JA", "EN"]) {
    await page.getByRole("button", { name: language, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/mekoniq-lab-${language.toLowerCase()}.png`,
      fullPage: true,
    });
  }
  await page.locator("#chassis").selectOption("valetudo");
  await expect(page.locator("#battery")).toBeDisabled();
  await expect(page.locator("#sensor")).toBeDisabled();
  await expect(page.locator(".metric").first().locator("strong")).toContainText(
    "—",
  );
});
