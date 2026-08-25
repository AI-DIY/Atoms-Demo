# Agent Studio

Agent Studio 将一句产品目标转化为可审阅、可运行的单页应用。它面向单机演示和小团队原型：用户提交目标，团队先给出计划，人工审批后才生成应用；生成结果在右侧受限 iframe 中直接运行。

## 能力、范围与边界

- 由团队负责人、产品经理、架构师、工程师四个核心角色协作；八个可调用专家为团队负责人、产品经理、架构师、工程师、研究员、数据分析师、SEO 专家和增长顾问。
- 团队计划需要人工审批，审批后生成独立 HTML 应用，并保存 V1、V2 等版本；支持向专家发送 `@研究员`、`@架构师` 等消息，以及恢复历史版本。
- Mock Provider 可以无 API Key 演示；真实模式通过兼容 OpenAI Responses API 的服务生成内容。
- 面向单台 2 vCPU / 2 GB RAM 主机。SQLite、进程内并发控制和进程内限流不适合多节点部署。

本项目提供邮箱账户和 HttpOnly 会话；模型配置统一由 Linux 宿主机管理，所有登录用户共享同一套额度与模型。它不提供邮箱验证、密码找回、多人实时协作、云端对象存储或横向扩缩容。生成的预约数据只保存在 iframe 当前浏览器会话中；用户、项目元数据、消息和版本保存在 SQLite。

## 架构

- Next.js App Router 同时提供工作区 UI 与 API；Prisma 使用 SQLite 保存项目、运行、消息和版本。
- 长任务 API 使用 SSE 发送步骤和完成事件，Nginx 必须关闭响应缓冲。
- 生成的 HTML 先做安全清理，再以 `srcDoc` 加载在 `sandbox="allow-scripts allow-forms"` iframe 中。它可以运行本地脚本和提交本地表单，但不能取得同源权限或导航顶层页面。
- `MOCK_LLM=true` 时使用确定性的 Mock Provider；真实模式只读取宿主机的 Responses API 环境变量，不会读取或回退到用户数据库配置。

## 本地 Mock 演示

前提：Node.js 22、pnpm 10。Windows 可用 PowerShell，Linux/macOS 使用等价命令。

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

打开 `http://localhost:3000`。注册或登录后会直接进入工作台。`.env.example` 默认包含 `MOCK_LLM="true"`，无需 API Key；将其设为 `false` 时，服务端读取以下统一的 Responses API 配置。

## 环境变量

| 变量 | 必填场景 | 示例 | 说明 |
| --- | --- | --- | --- |
| `DATABASE_URL` | 全部 | `file:./dev.db` | Prisma SQLite URL。生产环境使用 `file:/var/lib/agent-studio/agent-studio.db`。 |
| `MOCK_LLM` | 全部 | `true` 或 `false` | 仅精确值 `true` 启用无 Key Mock。生产应设为 `false`。 |
| `RESPONSES_API_BASE_URL` | 真实模型 | `https://api.example.com/v1` | 统一 Responses API Base URL，仅服务端读取。 |
| `RESPONSES_API_KEY` | 真实模型 | `sk-...` | 统一 API Key，仅服务端读取。 |
| `RESPONSES_MODEL` | 真实模型 | `gpt-5.5` | 统一模型 ID。 |
| `RESPONSES_MAX_OUTPUT_TOKENS` | 可选 | `4096` | 256 至 32768 的整数。 |
| `RESPONSES_REASONING_EFFORT` | 可选 | `medium` | `none`、`low`、`medium` 或 `high`。 |
| `NODE_ENV` | 生产 | `production` | systemd 服务已设置。 |
| `HOSTNAME` | 生产 | `127.0.0.1` | Next standalone 仅监听 loopback，公网入口只能是 Nginx。 |
| `PORT` | 生产 | `3000` | Next standalone 监听端口。 |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | 可选 E2E | `/usr/bin/chromium` | 缺少 Playwright 下载浏览器时，提供 Chromium 可执行文件路径；正常 CI 不需要设置。 |

不要创建或使用 `OPENAI_*`、`NEXT_PUBLIC_OPENAI_*` 或 `NEXT_PUBLIC_RESPONSES_*` 变量。模型 Base URL、API Key 和模型信息必须只存在于宿主机的 `/etc/agent-studio.env`；浏览器和数据库配置 API 都不会接触 API Key。

## 数据库备份与恢复

本地开发数据库位于 `prisma/dev.db`；单元测试和 E2E 分别使用隔离的 `prisma/test.db` 和 `prisma/e2e.db`。生产数据库位于 `/var/lib/agent-studio/agent-studio.db`。

在生产机安装 `sqlite3` 后，用 SQLite 的一致性备份命令：

```sh
sudo install -d -o agentstudio -g agentstudio /var/backups/agent-studio
sudo -u agentstudio sqlite3 /var/lib/agent-studio/agent-studio.db ".backup '/var/backups/agent-studio/agent-studio-$(date +%F).db'"
```

恢复时先停止服务，再替换数据库并恢复权限：

```sh
sudo systemctl stop agent-studio
sudo install -o agentstudio -g agentstudio -m 600 \
  /var/backups/agent-studio/agent-studio-YYYY-MM-DD.db \
  /var/lib/agent-studio/agent-studio.db
sudo systemctl start agent-studio
```

## Ubuntu 2C2G 部署

以下步骤假设部署目录为 `/opt/agent-studio`，Nginx 是唯一公网入口。先安装 Node.js 22、构建工具和 Nginx：

```sh
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs nginx git sqlite3
sudo corepack enable
sudo useradd --system --user-group --home-dir /opt/agent-studio --shell /usr/sbin/nologin agentstudio
sudo install -d -o agentstudio -g agentstudio /opt/agent-studio /var/lib/agent-studio
sudo -u agentstudio git clone <YOUR_REPOSITORY_URL> /opt/agent-studio
```

在部署后手动编辑 `/etc/agent-studio.env`。不要把这个文件提交到仓库，也不要将变量改为 `NEXT_PUBLIC_*`：

```sh
sudo install -m 640 -o root -g agentstudio /dev/null /etc/agent-studio.env
sudoedit /etc/agent-studio.env
```

生产必须关闭 Mock，并设置统一的 Responses API 配置。推荐使用仓库提供的交互式脚本，它不会回显 API Key，完成后会重启服务：

```dotenv
DATABASE_URL="file:/var/lib/agent-studio/agent-studio.db"
MOCK_LLM="false"
```

```sh
sudo bash deploy/configure-host-responses.sh
```

升级已有生产实例时，如果要把某个已加密的旧用户配置安全迁移到统一宿主机配置，可在服务器内执行一次。该脚本不会输出 API Key：

```sh
sudo node deploy/migrate-encrypted-model-config.cjs user@example.com
sudo systemctl restart agent-studio
```

可在服务器内发起一条最小 Responses 请求，确认统一配置可用且不会显示 API Key：

```sh
sudo node deploy/verify-host-responses.cjs
```

以下检查会注册临时账户、创建临时项目并完成一轮真实 Builder 生成，用于部署验收：

```sh
sudo node deploy/verify-builder-flow.cjs
```

构建、迁移，并将 standalone 所需静态资源复制到产物目录。即使当前仓库没有静态资源，也保留 `public` 复制步骤，后续新增资源不会在生产环境丢失：

```sh
cd /opt/agent-studio
sudo -u agentstudio pnpm install --frozen-lockfile
sudo -u agentstudio pnpm db:generate
sudo -u agentstudio env DATABASE_URL="file:/var/lib/agent-studio/agent-studio.db" pnpm exec prisma migrate deploy
sudo -u agentstudio pnpm build
sudo -u agentstudio mkdir -p public .next/standalone/.next .next/standalone/public
sudo -u agentstudio cp -R .next/static .next/standalone/.next/static
sudo -u agentstudio cp -R public/. .next/standalone/public/
```

安装 systemd 与 Nginx 配置，检查后启用：

```sh
sudo install -m 644 deploy/agent-studio.service /etc/systemd/system/agent-studio.service
sudo install -m 644 deploy/nginx-agent-studio.conf /etc/nginx/sites-available/agent-studio
sudo ln -s /etc/nginx/sites-available/agent-studio /etc/nginx/sites-enabled/agent-studio
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl daemon-reload
sudo systemctl enable --now agent-studio
sudo systemctl status agent-studio --no-pager
sudo nginx -t
sudo systemctl reload nginx
```

构建阶段在 2 GB 内存主机上容易出现短暂内存峰值，建议配置 1 GB swap：

```sh
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

`agent-studio.service` 将 Next 绑定到 `127.0.0.1:3000`；防火墙不要公开该端口，仅开放 Nginx 的 80/443。应用限流优先信任 `X-Real-IP`，因此 Nginx 配置必须用 `$remote_addr` 覆盖该头，并且不能允许绕过 Nginx 直接访问 Node 端口。

## 验证

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
git diff --check
```

部署机还应检查：

```sh
curl -I http://127.0.0.1:3000
sudo systemctl status agent-studio --no-pager
sudo nginx -t
```

## 评估演示脚本

1. 用 `MOCK_LLM="true"` 启动应用，打开一个无历史 localStorage 的浏览器窗口。
2. 在输入框填写“为摄影师创建预约与报价工具”，点击“制定团队计划”，等待“开始构建”。
3. 点击“开始构建”，等待右侧 `Generated application` iframe 出现；填写客户姓名、预约日期和拍摄服务，点击“添加预约”，确认新预约出现在列表中。
4. 在主输入框发送 `@研究员 调研摄影师预约转化的主要阻碍`，等待专家摘要出现在消息记录中。
5. 再发送“将预约表单改为双列布局”以生成 V2；打开“版本”，点击 V1，确认右上角版本标识回到 `V1`。

Mock 演示不需要 Key。生产环境应设 `MOCK_LLM="false"` 并配置完整的 `RESPONSES_*` 服务端变量；配置缺失会显式失败，不会把生产请求静默转向 Mock。
