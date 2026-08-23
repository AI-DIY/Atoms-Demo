# 用户认证与 Responses API 模型配置设计

## 目标

为 Agent Studio 增加邮箱注册/登录、当前用户模型配置和首次初始化向导，同时保持现有项目协作、SSE 运行、审批和版本预览功能可用。模型配置面向 OpenAI Responses API 及兼容端点，用户可在初始化后随时修改。

## 用户流程

1. 未登录用户看到邮箱注册/登录表单。
2. 注册成功后进入单页分步初始化向导：账户、模型配置、工作区。
3. 模型配置填写 Base URL、API Key、模型 ID、显示名称、备注、最大输出 Token 和推理强度，点击“测试连接”验证端点。
4. 配置保存成功后初始化默认项目并进入现有工作区。
5. 已登录用户可在工作区侧边栏打开模型配置页面，编辑配置、重新测试连接或退出登录。

## 数据模型

- `User`：邮箱唯一、密码哈希、初始化状态和时间戳。
- `Session`：不可逆哈希后的会话令牌、用户、过期时间和创建时间。
- `ModelConfig`：每个用户一条配置；保存端点、加密 API Key、模型 ID、显示名称、备注、最大输出 Token、推理强度。
- `Project.userId`：项目归属用户。保留现有 owner token 字段用于兼容已有数据和测试，但新页面以会话校验为主。

API Key 使用 AES-256-GCM 加密后写入数据库，密钥来自服务端 `MODEL_CONFIG_ENCRYPTION_KEY`，不进入浏览器响应。密码使用 Node `crypto.scrypt` 哈希并带随机盐。登录态使用 HttpOnly、SameSite=Lax Cookie；生产环境设置 Secure。

## API 与服务边界

- `/api/auth/register`、`/api/auth/login`、`/api/auth/logout`、`/api/auth/me`：注册、登录、退出和当前用户状态。
- `/api/model-config`：读取脱敏配置、创建或更新配置。
- `/api/model-config/test`：使用提交的临时配置调用 Responses API，返回成功或安全错误，不持久化 API Key。
- 项目与运行 API 优先从会话取得用户，再校验项目归属；运行时按用户配置创建 OpenAI provider。Mock 模式仍由服务端环境变量控制。

## Provider 配置

扩展现有 OpenAI provider 工厂，使 `getAgentProvider` 接受显式用户配置。模型 ID、最大输出 Token、推理强度进入 Responses 请求；兼容端点不支持的可选参数只在对应配置存在时发送，结构化输出回退逻辑保持不变。没有用户配置时返回明确的 503/409 错误，避免静默使用其他用户或环境密钥。

## 前端组件

- `AuthPage`：邮箱注册/登录切换、表单校验、错误状态。
- `OnboardingWizard`：A 型单页分步向导，显示账户、模型、工作区进度；模型步骤复用配置表单。
- `ModelConfigPanel`：Base URL、API Key、模型元数据和测试/保存操作，API Key 已存在时显示脱敏值。
- `AppShell`：根据 `/api/auth/me` 状态选择认证页、初始化向导或现有 `WorkspaceShell`。
- 侧边栏增加当前用户入口、模型设置和退出登录。

## 错误处理与安全

- 注册邮箱统一转小写并校验格式；重复邮箱返回通用错误。
- 登录失败不区分邮箱不存在或密码错误。
- API Key、密码和会话原文不写日志；provider 错误继续做密钥脱敏。
- 测试连接限制请求体大小并复用现有限流；失败只返回用户可读错误。
- Cookie 缺失、过期或项目不属于当前用户时返回 401/404，不泄露资源存在性。

## 验证范围

- 单元测试：密码哈希/验证、会话解析、配置加解密、模型配置校验、provider 可选参数。
- 集成测试：注册/登录/退出、模型配置读写与脱敏、测试连接、项目归属和运行时按用户配置取 provider。
- 组件测试：认证页、向导步骤切换、配置保存/错误状态。
- 运行 `pnpm test`、`pnpm exec tsc --noEmit`、`pnpm build` 和 `git diff --check`。
