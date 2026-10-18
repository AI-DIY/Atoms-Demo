import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

async function expectVersion(page: Page, version: string) {
  const ready = page.locator(".version-chip").filter({ hasText: new RegExp(`^${version}$`) });
  const error = page.locator(".workspace-error");
  await expect(ready.or(error)).toBeVisible({ timeout: 300_000 });
  if (await error.isVisible()) throw new Error(`Generation failed: ${await error.innerText()}`);
  await expect(ready).toBeVisible();
}

// Explicit opt-in: this suite uses a deployed real model and consumes its quota.
test("real model generates a working app with persistence and public sharing", async ({ page, browser, baseURL }) => {
  test.skip(process.env.RUN_LIVE_TEST !== "1", "Set RUN_LIVE_TEST=1 to run real model acceptance");
  const email = `delivery-${Date.now()}@example.com`;
  const password = randomBytes(24).toString("base64url");
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(".artifacts/live-account.json", JSON.stringify({ email, password }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill(email);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByText("真实 AI · Responses API")).toBeVisible();
  await expect(page.getByRole("button", { name: "制定团队计划" })).toBeEnabled();
  await page.getByRole("textbox", { name: "描述你要构建的产品" }).fill("创建一个摄影预约与报价工作台，中文界面，温暖的米色和绿色。表单包含标签为客户姓名的文本输入、预约日期的date输入、拍摄服务的文本输入，点击添加预约按钮后展示客户、日期、服务和默认报价500元；每条记录有删除预约按钮。保存到localStorage并在刷新后恢复。有预约数量和预计收入统计、空状态、响应式布局。不要依赖外部服务。");
  await page.getByRole("button", { name: "制定团队计划" }).click();
  await expectVersion(page, "V1");
  const app = page.frameLocator('iframe[title="Generated application"]');
  await app.getByLabel("客户姓名", { exact: true }).fill("验收客户");
  await app.getByLabel("预约日期", { exact: true }).fill("2026-10-22");
  await app.getByLabel("拍摄服务", { exact: true }).fill("人像摄影");
  await app.getByRole("button", { name: "添加预约", exact: true }).click();
  await expect(app.getByText("验收客户", { exact: true })).toBeVisible();
  const identity = await page.evaluate(() => JSON.parse(localStorage.getItem("agent-studio-owner-token")!));
  await expect.poll(async () => JSON.stringify(await (await page.request.get(`/api/projects/${identity.projectId}/state`)).json())).toContain("验收客户");
  await page.reload();
  await expect(app.getByText("验收客户", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".artifacts/live-desktop.png", fullPage: true });
  await page.getByRole("textbox", { name: "描述希望修改的内容" }).fill("保留现有功能、所有表单标签和存储键，只把添加预约按钮改为蓝色。");
  await page.getByRole("button", { name: "修改当前成果" }).click();
  await expectVersion(page, "V2");
  await expect(app.getByText("验收客户", { exact: true })).toBeVisible();
  const buttonColor = await app.getByRole("button", { name: "添加预约", exact: true }).evaluate((button) => getComputedStyle(button).backgroundColor);
  const channels = buttonColor.match(/\d+/g)!.map(Number);
  expect(channels[2]).toBeGreaterThan(channels[0]);
  expect(channels[2]).toBeGreaterThan(channels[1]);
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.getByRole("button", { name: "确认公开发布" }).click();
  const share = page.getByRole("link", { name: "打开公开应用 ↗" });
  await expect(share).toBeVisible();
  const sharePath = (await share.getAttribute("href"))!;
  const guest = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const guestPage = await guest.newPage();
  await guestPage.goto(new URL(sharePath, baseURL).href);
  const guestApp = guestPage.frameLocator('iframe[title="Generated application"]');
  await expect(guestApp.getByRole("button", { name: "添加预约", exact: true })).toBeVisible();
  await expect(guestApp.getByText("验收客户", { exact: true })).toHaveCount(0);
  await guestApp.getByLabel("客户姓名", { exact: true }).fill("访客体验");
  await guestApp.getByLabel("预约日期", { exact: true }).fill("2026-10-23");
  await guestApp.getByLabel("拍摄服务", { exact: true }).fill("活动摄影");
  await guestApp.getByRole("button", { name: "添加预约", exact: true }).click();
  await expect(guestPage.getByText("数据已保存在此浏览器")).toBeVisible();
  await guestPage.reload();
  await expect(guestApp.getByText("访客体验", { exact: true })).toBeVisible();
  await guestPage.screenshot({ path: ".artifacts/live-published.png", fullPage: true });
  guestPage.on("dialog", (dialog) => dialog.accept());
  await guestApp.getByRole("button", { name: /删除.*预约/ }).click();
  await expect(guestApp.getByText("访客体验", { exact: true })).toHaveCount(0);
  await guest.close();
  await page.getByRole("button", { name: "版本", exact: true }).click();
  await page.getByRole("button", { name: "V1", exact: true }).click();
  await expect(page.locator(".version-chip")).toHaveText("V1");
  await expect(page.getByText("线上版本 V2")).toBeVisible();
  await expect(app.getByText("验收客户", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('iframe[title="Generated application"]').scrollIntoViewIfNeeded();
  await expect(app.getByText("验收客户", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".artifacts/live-mobile.png", fullPage: true });
  writeFileSync(".artifacts/live-verification.json", JSON.stringify({
    testedAt: new Date().toISOString(), origin: baseURL, mode: "live", projectId: identity.projectId,
    publishedUrl: new URL(sharePath, baseURL).href,
    checks: ["register", "team-generation-v1", "form-submit", "sqlite-persistence", "reload", "real-iteration-v2", "publish", "anonymous-visitor-isolation", "visitor-persistence", "delete-record", "restore-v1-keeps-data-and-public-v2", "mobile-no-overflow"],
  }, null, 2));
});
