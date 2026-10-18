import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, prefix: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page
    .getByRole("textbox", { name: "邮箱" })
    .fill(`${prefix}-${Date.now()}@example.com`);
  await page
    .getByLabel("密码", { exact: true })
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("演示模式 · 内置模板")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "描述你的产品想法" }),
  ).toBeVisible();
}

async function buildFromHome(
  page: Page,
  request = "为摄影师创建预约与报价工具",
) {
  await page.getByRole("textbox", { name: "描述你的产品想法" }).fill(request);
  await expect(
    page.getByRole("textbox", { name: "描述你的产品想法" }),
  ).toHaveValue(request);
  await page.getByRole("button", { name: "开始构建" }).click();
  await expect(page.locator(".version-chip")).toHaveText("V1");
}

test("complete builder journey persists data, switches projects, iterates, publishes and revokes", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await register(page, "journey");
  await buildFromHome(page);
  const app = page.frameLocator('iframe[title="Generated application"]');
  await expect(
    app.getByRole("heading", { name: "摄影预约工作台" }),
  ).toBeVisible();
  await app.getByLabel("客户姓名").fill("林墨");
  await app.getByLabel("预约日期").fill("2026-10-20");
  await app.getByLabel("拍摄服务").fill("人像摄影");
  await app.getByRole("button", { name: "添加预约" }).click();
  await expect(page.getByText("应用数据已保存", { exact: true })).toBeVisible();
  await page.reload();
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  await page.getByRole("button", { name: "刷新预览" }).click();
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  await page.getByRole("button", { name: "移动端预览" }).click();
  await expect(page.locator(".preview-window")).toHaveClass(/mobile-preview/);
  await page.getByRole("button", { name: "移动端预览" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 HTML" }).click();
  expect((await downloadEvent).suggestedFilename()).toBe(
    "agent-studio-v1.html",
  );

  await page.getByRole("button", { name: /你的 AI 团队/ }).click();
  await page.getByRole("button", { name: "Iris 研究员" }).click();
  await page
    .getByRole("textbox", { name: "描述希望修改的内容" })
    .fill("@研究员 调研预约流程");
  await page.getByRole("button", { name: "修改当前成果" }).click();
  await expect(page.getByText(/已整理.*初步研究假设/)).toBeVisible();
  await page
    .getByRole("textbox", { name: "描述希望修改的内容" })
    .fill("将预约表单改为双列布局，并使用绿色按钮");
  await page.getByRole("button", { name: "修改当前成果" }).click();
  await expect(page.locator(".version-chip")).toHaveText("V2");
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.getByRole("button", { name: "确认公开发布" }).click();
  const share = page.getByRole("link", { name: "打开公开应用 ↗" });
  await expect(share).toBeVisible();
  const publicUrl = await share.getAttribute("href");
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await guestPage.goto(publicUrl!);
  const publicApp = guestPage.frameLocator(
    'iframe[title="Generated application"]',
  );
  await expect(
    publicApp.getByRole("heading", { name: "摄影预约工作台" }),
  ).toBeVisible();
  await expect(publicApp.getByText("林墨 · 2026-10-20 · 人像摄影")).toHaveCount(
    0,
  );
  await publicApp.getByLabel("客户姓名").fill("访客");
  await publicApp.getByLabel("预约日期").fill("2026-10-21");
  await publicApp.getByLabel("拍摄服务").fill("婚礼");
  await publicApp.getByRole("button", { name: "添加预约" }).click();
  await expect(guestPage.getByText("数据已保存在此浏览器")).toBeVisible();
  await guestPage.reload();
  await expect(publicApp.getByText("访客 · 2026-10-21 · 婚礼")).toBeVisible();
  await page.getByRole("button", { name: "版本", exact: true }).click();
  await page.getByRole("button", { name: "V1", exact: true }).click();
  await expect(page.locator(".version-chip")).toHaveText("V1");
  await expect(page.getByText("线上版本 V2")).toBeVisible();
  await page.getByRole("button", { name: "取消发布" }).click();
  await expect(share).toHaveCount(0);
  expect((await guestPage.reload())?.status()).toBe(404);
  await guest.close();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "代码", exact: true }).click();
  const source = page.getByRole("textbox", { name: "HTML 源码" });
  await source.fill(
    (await source.inputValue()).replaceAll("摄影预约工作台", "光影预约工作台"),
  );
  await page.getByRole("button", { name: "保存新版本" }).click();
  await expect(page.locator(".version-chip")).toHaveText("V3");
  await expect(
    app.getByRole("heading", { name: "光影预约工作台" }),
  ).toBeVisible();
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  await page.getByRole("button", { name: "专注预览", exact: true }).click();
  await expect(page.locator(".is-expanded")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".is-expanded")).toHaveCount(0);
  await page.getByRole("button", { name: "返回我的项目" }).click();
  await page
    .getByRole("button", { name: "重命名 为摄影师创建预约与报价工具" })
    .click();
  await page.getByLabel("项目名称", { exact: true }).fill("光影预约助手");
  await page.getByRole("button", { name: "保存名称" }).click();
  await expect(
    page.getByRole("button", { name: "打开项目 光影预约助手" }),
  ).toBeVisible();
  await page.getByLabel("搜索项目").fill("不存在的名字");
  await expect(
    page.getByRole("heading", { name: "没有找到匹配的项目" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await page.getByRole("button", { name: "切换列表视图" }).click();
  await expect(page.locator(".project-grid")).toHaveClass(/as-list/);
  await page.screenshot({
    path: "test-results/projects-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "新建项目" }).click();
  await buildFromHome(page, "为内容团队创建内容日历，记录选题与发布时间");
  await page.getByRole("button", { name: "返回我的项目" }).click();
  await page.getByRole("button", { name: "打开项目 光影预约助手" }).click();
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  // Losing local storage must not lose database-owned projects.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "光影预约助手", exact: true }),
  ).toBeVisible();
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("complementary", { name: "主导航", includeHidden: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "预览", exact: true }).first().click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(app.getByText("林墨 · 2026-10-20 · 人像摄影")).toBeVisible();
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
});

test("sandbox blocks generated network access and cross-account project access", async ({
  page,
  browser,
}) => {
  await register(page, "isolation");
  await buildFromHome(page);
  await expect(page.locator(".version-chip")).toHaveText("V1");
  await expect(
    page
      .frameLocator('iframe[title="Generated application"]')
      .getByRole("heading", { name: "摄影预约工作台" }),
  ).toBeVisible();
  const identity = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("agent-studio-owner-token")!),
  );
  const frame = page.frames().find((item) => item.parentFrame());
  page.once("dialog", (dialog) => dialog.accept());
  expect(await frame!.evaluate(() => confirm("确认删除测试记录？"))).toBe(true);
  expect(
    await frame!.evaluate(async () => {
      try {
        await fetch("/api/auth/me");
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  expect(
    await frame!.evaluate(() => {
      try {
        return Boolean(parent.document);
      } catch {
        return false;
      }
    }),
  ).toBe(false);
  const other = await browser.newContext();
  expect(
    (
      await other.request.get(`/api/projects/${identity.projectId}/state`)
    ).status(),
  ).toBe(401);
  const second = await other.newPage();
  await register(second, "other");
  expect(
    (await other.request.get(`/api/projects/${identity.projectId}`)).status(),
  ).toBe(404);
  expect(
    (
      await other.request.post(`/api/projects/${identity.projectId}/publish`)
    ).status(),
  ).toBe(404);
  await other.close();
});

test("resources filter and persist bookmarks; a guest idea survives registration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "你的下一个产品从这里开始。" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "资源", exact: true }).click();
  await expect(page.locator(".resource-card")).toHaveCount(6);
  await page.screenshot({
    path: "test-results/resources-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "生产力", exact: true }).click();
  await expect(page.locator(".resource-card")).toHaveCount(3);
  await page.getByLabel("搜索资源").fill("日积");
  await expect(page.locator(".resource-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "收藏日积 · 习惯打卡", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "已收藏 1", exact: true }).click();
  await expect(page.locator(".resource-card")).toHaveCount(1);
  await page.getByRole("button", { name: "已收藏 1", exact: true }).click();
  await page.getByRole("button", { name: "模板", exact: true }).click();
  await expect(page.locator(".resource-card")).toHaveCount(3);
  await page
    .getByRole("button", { name: "查看光影之间 · 摄影预约", exact: true })
    .click();
  await page.getByRole("button", { name: "使用此创意" }).click();
  await expect(page.getByLabel("描述你的产品想法")).toHaveValue(/摄影工作室/);
  await page.getByRole("button", { name: "开始构建" }).click();
  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page
    .getByLabel("邮箱", { exact: true })
    .fill(`idea-${Date.now()}@example.com`);
  await page
    .getByLabel("密码", { exact: true })
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "注册", exact: true }).click();
  await expect(page.locator(".version-chip")).toHaveText("V1");
  const projects = await (await page.request.get("/api/projects")).json();
  expect(projects.projects).toHaveLength(1);
  expect(projects.projects[0].goal).toContain("摄影工作室");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航" }).click();
  await page.getByRole("button", { name: "首页", exact: true }).click();
  await expect(page.getByLabel("描述你的产品想法")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
});
