# Atoms Demo 2.0.0

从一句产品目标出发，通过团队负责人、产品经理、架构师和工程师的协作，生成可交互的网页应用，再继续迭代、保存数据、恢复版本和发布分享。

- **在线 Demo**：[atoms.ai-diy.me](http://atoms.ai-diy.me)
- **真实生成应用示例**：[摄影预约与报价工作台 · V3，无需登录](http://atoms.ai-diy.me/share/qSNZtk4RAOGFpM1NQ-cZW4Jb)
- **笔试交付文档**：[全栈岗位笔试——赵心语](./全栈岗位笔试——赵心语/README.md)
- **实现思路、完成度、AI Coding 与扩展计划**：[补充说明](./补充说明/全栈岗位笔试——赵心语.md)
- **测试、部署和 Dufs 核验**：[验收与部署记录](./补充说明/验收与部署记录.md)
- **官网对照与界面改版**：[首页、资源、项目与工作区](./补充说明/官网对照与改版说明.md)
- **版本**：[2.0.0](https://github.com/AI-DIY/Atoms-Demo/tree/2.0.0)

## 已实现

Atoms 风格深灰首页、产品想法输入、资源分类/搜索/收藏、邮箱注册和登录、账户隔离、项目搜索/排序/重命名/切换、SSE 团队进度、可展开的结构化交付文档、八个专家的 `@` 咨询、真实 Responses 模型生成、自然语言迭代、桌面/移动预览、专注预览、HTML 源码编辑与新版本保存、历史版本恢复、HTML 下载及公开发布/更新/撤销。

生成应用通过 `localStorage.getItem/setItem` 使用宿主提供的存储桥。工作区数据按项目写入 SQLite，刷新和重新登录后可恢复；公开页面的数据仅保存在访客自己的浏览器，不能访问作者数据。发布固定版本，恢复或迭代工作区不会自动改变已发布应用。

## 本地启动

需要 Node.js 22+、pnpm 10.30.1。初次启动使用明确标注的模板演示模式，无需 API Key。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm dev
```

打开 `http://localhost:3000`，在首页描述想法或从资源库选择创意，点击“开始构建”。未登录时先注册邮箱账户，随后自动进入团队工作区并继续构建。手机端可以切换“对话”和“预览”面板。

PowerShell 可用 `Copy-Item .env.example .env` 替代 `cp`。生产环境使用 `prisma migrate deploy`，不要执行重置数据库的命令。

## 模型配置

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | SQLite 位置；本地 `file:./dev.db`，生产 `file:/var/lib/agent-studio/agent-studio.db` |
| `MOCK_LLM` | 仅 `true` 使用模板演示；线上为 `false` |
| `RESPONSES_API_BASE_URL` | Responses 兼容服务的根路径，例如 `https://provider.example/v1`，不要重复包含 `/responses` |
| `RESPONSES_API_KEY` | 服务端密钥，不进入浏览器、数据库模型配置或 Git |
| `RESPONSES_MODEL` | 服务提供方支持的模型 ID |
| `RESPONSES_MAX_OUTPUT_TOKENS` | 可选，256–32768；线上使用 8192 |
| `RESPONSES_REASONING_EFFORT` | 可选，none/low/medium/high |

生产配置只保存在 `/etc/agent-studio.env`，权限 `root:agentstudio 0640`。缺少真实模型配置时明确报错，不自动退回模板。`/api/health` 只报告版本、服务状态和 live/demo 模式，不返回密钥、模型名或供应商地址。

演示模式提供摄影预约、内容日历、销售线索三个模板；迭代支持双列布局、蓝色/绿色按钮及深色主题。模板以外的任意需求需要真实模型，不将固定模板包装成真实 AI 输出。

## 架构与边界

Next.js App Router + React + TypeScript 提供界面和服务端 API，Prisma + SQLite 持久化账户、会话、项目、对话、运行、产物版本、发布信息和应用数据。每个角色独立调用模型，结构化产物依次传递；验收角色为确定性结构校验，不是浏览器功能测试。

生成范围是独立 HTML/CSS/JavaScript 单页应用，不安装任意依赖，也不执行模型生成的服务端代码。预览采用无同源权限的 sandbox iframe，CSP 阻止网络访问和表单外发；父页面只接收当前 iframe 的有界存储消息。单份 HTML 上限 50 KB，项目业务数据上限 64 KB。

这是单机原型：没有邮件验证/找回密码、多人共同编辑、通用云后端、支付集成和分布式任务队列。存储桥使用整份快照，多个标签页同时修改时按最后写入为准。HTML 下载仅导出应用代码，不携带工作区业务数据。

## 验证

```sh
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
git diff --check
```

测试使用独立的 `prisma/test.db`、`prisma/e2e.db`，不会访问生产数据库。端到端测试覆盖真实浏览器交互、刷新持久化、版本回退、项目切换、公开访问与撤销、移动端和隔离边界。

## 服务器部署

本次服务器是 `ssh aliyun-chenli`，域名 `atoms.ai-diy.me`，实际 IP `39.105.85.114`。Dufs 保留既有 `443` 端口；Demo 独立使用 HTTP 80 → loopback 3000。应用、代理和构建均有独立资源限制。没有改动 Docker、Dufs 容器、数据目录或 TLS 配置。

服务器目录：

```text
/opt/agent-studio/runtime/          Node.js 与 pnpm
/opt/agent-studio/releases/2.0.0-delivery/   版本源码与构建产物
/opt/agent-studio/current          当前版本符号链接
/etc/agent-studio.env              仅服务端可读的模型配置
/var/lib/agent-studio/             SQLite 持久数据
/var/backups/agent-studio/          一致性数据库备份
```

使用 `deploy/build-release.sh` 构建指定版本，`deploy/activate-release.sh /opt/agent-studio/releases/2.0.0-delivery` 执行备份、迁移、切换和健康检查。脚本仅管理 `agent-studio` 与 `agent-studio-proxy`；代理采用自己的 Nginx 配置，不启用发行版默认 Nginx 服务。

每次构建必须使用新的独立版本目录。构建脚本会拒绝在 `current` 指向的活动版本目录中运行，避免 Next.js 清理正在使用的产物。

```sh
systemctl status agent-studio agent-studio-proxy --no-pager
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://atoms.ai-diy.me/api/health
journalctl -u agent-studio -n 50 --no-pager
```

生产目前使用 HTTP。若要同时让 Dufs 与本应用共用标准 HTTPS 443，需要另行规划统一入口或独立 IP；本次遵守现有 Dufs 服务的端口边界。

## 参考

本项目参考 Atoms 的产品工作流与交互，非 Atoms 官方产品。参阅 [欢迎使用 Atoms](https://help.atoms.dev/zh/articles/12129543-welcome-to-atoms)、[快速开始](https://help.atoms.dev/zh/articles/12129545-quick-start)、[项目聊天](https://help.atoms.dev/zh/articles/12129550-project-chat)、[App 预览](https://help.atoms.dev/zh/articles/12129554-app-viewer)、[项目历史记录](https://help.atoms.dev/zh/articles/12129557-project-history)、[发布项目](https://help.atoms.dev/zh/articles/12129577-publish-your-project)。
