import { expect, test } from "@playwright/test";

test("builds a booking app through approval and preserves a specialist response", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "还没有账户？注册" }).click();
  await page.getByRole("textbox", { name: "邮箱" }).fill("e2e@example.com");
  await page.getByRole("textbox", { name: "密码" }).fill("correct horse battery staple");
  await page.getByRole("button", { name: "注册" }).click();
  await page.getByRole("textbox", { name: "API Key" }).fill("sk-e2e-test-key");
  await page.getByRole("button", { name: "测试连接" }).click();
  await expect(page.getByText("连接测试成功，可以保存。" )).toBeVisible();
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("button", { name: "进入工作区" }).click();

  await expect(page.getByRole("heading", { name: "从目标到可运行应用" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "摄影预约助手" })).toBeVisible();

  const request = page.getByRole("textbox", { name: "描述你要构建的产品" });
  await request.fill("为摄影师创建预约与报价工具");
  await page.getByRole("button", { name: "制定团队计划" }).click();

  await expect(page.getByRole("region", { name: "团队计划审批" })).toBeVisible();
  await page.getByRole("button", { name: "开始构建" }).click();

  const application = page.frameLocator('iframe[title="Generated application"]');
  await expect(application.getByRole("heading", { name: "摄影预约工作台" })).toBeVisible();
  await application.getByLabel("客户姓名").fill("林墨");
  await application.getByLabel("预约日期").fill("2026-08-23");
  await application.getByLabel("拍摄服务").fill("人像摄影");
  await application.getByRole("button", { name: "添加预约" }).click();
  await expect(application.getByText("林墨 · 2026-08-23 · 人像摄影")).toBeVisible();

  await page.getByRole("button", { name: "版本" }).click();
  await page.getByRole("button", { name: "V1" }).click();
  await expect(page.locator(".version-chip")).toHaveText("V1");

  const completedEvents = page
    .getByRole("region", { name: "智能体运行时间线" })
    .getByText("已完成", { exact: true });
  await request.fill("@研");
  await page.getByRole("option", { name: "@研究员" }).click();
  await page.getByRole("button", { name: "制定团队计划" }).click();
  await expect(page.getByText(/已整理.*初步研究假设。/)).toBeVisible();
  await expect(completedEvents).toHaveCount(2);
});
