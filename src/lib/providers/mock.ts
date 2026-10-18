import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import type { RoleId } from "@/lib/domain";

type DemoTemplate = {
  title: string;
  productSummary: string;
  users: string[];
  scope: string[];
  flow: string[];
  acceptance: string[];
  pages: string[];
  state: string[];
  constraints: string[];
  html: string;
};

const bookingAppHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>摄影预约工作台</title>
  <style>
    :root { color: #1e293b; background: #f8fafc; font-family: system-ui, sans-serif; }
    body { max-width: 900px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { margin: 0 0 8px; } p { color: #475569; }
    form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; margin: 28px 0; }
    input, button { box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; min-height: 40px; padding: 8px 10px; font: inherit; }
    button { cursor: pointer; background: #0f766e; border-color: #0f766e; color: #fff; font-weight: 650; }
    #appointments { display: grid; gap: 10px; padding: 0; list-style: none; }
    .appointment { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; }
    .appointment button { min-height: 32px; background: #fff; color: #b91c1c; border-color: #fecaca; }
    @media (max-width: 680px) { form { grid-template-columns: 1fr; } }
  </style>
</head>
<body data-acceptance="页面在桌面和移动屏幕可用">
  <header>
    <h1>摄影预约工作台</h1>
    <p>集中安排拍摄时间，快速跟进客户需求。</p>
  </header>
  <form id="appointment-form" data-acceptance="用户可以添加包含客户、日期和服务的预约">
    <input id="client" aria-label="客户姓名" required placeholder="客户姓名">
    <input id="date" aria-label="预约日期" required type="date">
    <input id="service" aria-label="拍摄服务" required placeholder="拍摄服务">
    <button type="submit">添加预约</button>
  </form>
  <main>
    <h2>预约列表</h2>
    <ul id="appointments" aria-live="polite" data-acceptance="用户可以删除任意一条预约"></ul>
  </main>
  <script>
    const form = document.querySelector('#appointment-form');
    const list = document.querySelector('#appointments');
    const client = document.querySelector('#client');
    const date = document.querySelector('#date');
    const service = document.querySelector('#service');

    function addAppointment(name, bookingDate, bookingService) {
      const item = document.createElement('li');
      item.dataset.record = JSON.stringify([name, bookingDate, bookingService]);
      item.className = 'appointment';
      const details = document.createElement('span');
      details.textContent = name + ' · ' + bookingDate + ' · ' + bookingService;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '删除预约';
      remove.addEventListener('click', () => { item.remove(); saveItems(); });
      item.append(details, remove);
      list.append(item);
      saveItems();
    }

    function saveItems() { localStorage.setItem('appointments', JSON.stringify([...list.children].map(item => JSON.parse(item.dataset.record)))); }
    JSON.parse(localStorage.getItem('appointments') || '[]').forEach(row => addAppointment(...row));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      addAppointment(client.value.trim(), date.value, service.value.trim());
      form.reset();
      client.focus();
    });
  </script>
</body>
</html>`;

const contentCalendarAppHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>内容日历</title>
  <style>
    :root { color: #1e293b; background: #f8fafc; font-family: system-ui, sans-serif; }
    body { max-width: 900px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { margin: 0 0 8px; } p { color: #475569; }
    form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; margin: 28px 0; }
    input, button { box-sizing: border-box; min-height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
    button { cursor: pointer; background: #4338ca; border-color: #4338ca; color: #fff; font-weight: 650; }
    #content-items { display: grid; gap: 10px; padding: 0; list-style: none; }
    .content-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; }
    .content-item button { min-height: 32px; background: #fff; color: #b91c1c; border-color: #fecaca; }
    @media (max-width: 680px) { form { grid-template-columns: 1fr; } }
  </style>
</head>
<body data-acceptance="页面在桌面和移动屏幕可用">
  <header>
    <h1>内容日历</h1>
    <p>统一规划选题、发布日期和发布渠道。</p>
  </header>
  <form id="content-form" data-acceptance="用户可以添加包含标题、日期和渠道的内容计划">
    <input id="topic" aria-label="内容标题" required placeholder="内容标题">
    <input id="publish-date" aria-label="发布日期" required type="date">
    <input id="channel" aria-label="发布渠道" required placeholder="发布渠道">
    <button type="submit">添加内容</button>
  </form>
  <main>
    <h2>发布计划</h2>
    <ul id="content-items" aria-live="polite" data-acceptance="用户可以删除任意一条内容计划"></ul>
  </main>
  <script>
    const form = document.querySelector('#content-form');
    const list = document.querySelector('#content-items');
    const topic = document.querySelector('#topic');
    const publishDate = document.querySelector('#publish-date');
    const channel = document.querySelector('#channel');

    function addContent(title, date, selectedChannel) {
      const item = document.createElement('li');
      item.dataset.record = JSON.stringify([title, date, selectedChannel]);
      item.className = 'content-item';
      const details = document.createElement('span');
      details.textContent = title + ' · ' + date + ' · ' + selectedChannel;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '删除内容';
      remove.addEventListener('click', () => { item.remove(); saveItems(); });
      item.append(details, remove);
      list.append(item);
      saveItems();
    }

    function saveItems() { localStorage.setItem('content-items', JSON.stringify([...list.children].map(item => JSON.parse(item.dataset.record)))); }
    JSON.parse(localStorage.getItem('content-items') || '[]').forEach(row => addContent(...row));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      addContent(topic.value.trim(), publishDate.value, channel.value.trim());
      form.reset();
      topic.focus();
    });
  </script>
</body>
</html>`;

const leadBoardAppHtml = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>客户线索看板</title>
  <style>
    :root { color: #172554; background: #f8fafc; font-family: system-ui, sans-serif; }
    body { max-width: 900px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { margin: 0 0 8px; } p { color: #475569; }
    form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 12px; margin: 28px 0; }
    input, select, button { box-sizing: border-box; min-height: 40px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font: inherit; }
    button { cursor: pointer; background: #0369a1; border-color: #0369a1; color: #fff; font-weight: 650; }
    #leads { display: grid; gap: 10px; padding: 0; list-style: none; }
    .lead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; }
    .lead button { min-height: 32px; background: #fff; color: #b91c1c; border-color: #fecaca; }
    @media (max-width: 680px) { form { grid-template-columns: 1fr; } }
  </style>
</head>
<body data-acceptance="页面在桌面和移动屏幕可用">
  <header>
    <h1>客户线索看板</h1>
    <p>记录潜在客户，清晰跟进每个销售阶段。</p>
  </header>
  <form id="lead-form" data-acceptance="用户可以添加包含客户、联系人和阶段的线索">
    <input id="company" aria-label="客户名称" required placeholder="客户名称">
    <input id="contact" aria-label="联系人" required placeholder="联系人">
    <select id="stage" aria-label="线索阶段">
      <option>初步沟通</option>
      <option>需求确认</option>
      <option>报价跟进</option>
    </select>
    <button type="submit">添加线索</button>
  </form>
  <main>
    <h2>线索列表</h2>
    <ul id="leads" aria-live="polite" data-acceptance="用户可以删除任意一条线索"></ul>
  </main>
  <script>
    const form = document.querySelector('#lead-form');
    const list = document.querySelector('#leads');
    const company = document.querySelector('#company');
    const contact = document.querySelector('#contact');
    const stage = document.querySelector('#stage');

    function addLead(name, person, leadStage) {
      const item = document.createElement('li');
      item.dataset.record = JSON.stringify([name, person, leadStage]);
      item.className = 'lead';
      const details = document.createElement('span');
      details.textContent = name + ' · ' + person + ' · ' + leadStage;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '删除线索';
      remove.addEventListener('click', () => { item.remove(); saveItems(); });
      item.append(details, remove);
      list.append(item);
      saveItems();
    }

    function saveItems() { localStorage.setItem('leads', JSON.stringify([...list.children].map(item => JSON.parse(item.dataset.record)))); }
    JSON.parse(localStorage.getItem('leads') || '[]').forEach(row => addLead(...row));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      addLead(company.value.trim(), contact.value.trim(), stage.value);
      form.reset();
      company.focus();
    });
  </script>
</body>
</html>`;

const bookingTemplate: DemoTemplate = {
  title: "摄影预约工作台",
  productSummary: "预约与报价工具",
  users: ["独立摄影师", "需要预约拍摄的客户"],
  scope: ["创建预约", "查看预约列表", "删除不再需要的预约"],
  flow: ["填写客户、日期和服务", "添加预约", "在列表中管理预约"],
  acceptance: [
    "用户可以添加包含客户、日期和服务的预约",
    "用户可以删除任意一条预约",
    "页面在桌面和移动屏幕可用",
  ],
  pages: ["预约工作台（单页）"],
  state: ["预约列表", "表单中的客户、日期和服务字段"],
  constraints: [
    "使用原生 HTML、CSS 和 JavaScript",
    "不使用外部依赖或网络请求",
    "生成文档小于 50 KB",
  ],
  html: bookingAppHtml,
};

const contentCalendarTemplate: DemoTemplate = {
  title: "内容日历",
  productSummary: "内容日历",
  users: ["内容运营人员", "内容审核负责人"],
  scope: ["创建内容计划", "查看发布计划", "删除过期内容"],
  flow: ["填写标题、发布日期和渠道", "添加内容", "在发布计划中管理内容"],
  acceptance: [
    "用户可以添加包含标题、日期和渠道的内容计划",
    "用户可以删除任意一条内容计划",
    "页面在桌面和移动屏幕可用",
  ],
  pages: ["内容日历（单页）"],
  state: ["内容计划列表", "标题、发布日期和渠道字段"],
  constraints: [
    "使用原生 HTML、CSS 和 JavaScript",
    "不使用外部依赖或网络请求",
    "生成文档小于 50 KB",
  ],
  html: contentCalendarAppHtml,
};

const leadBoardTemplate: DemoTemplate = {
  title: "客户线索看板",
  productSummary: "客户线索看板",
  users: ["销售人员", "销售主管"],
  scope: ["添加客户线索", "查看线索阶段", "删除无效线索"],
  flow: ["填写客户、联系人和阶段", "添加线索", "在线索列表中跟进"],
  acceptance: [
    "用户可以添加包含客户、联系人和阶段的线索",
    "用户可以删除任意一条线索",
    "页面在桌面和移动屏幕可用",
  ],
  pages: ["客户线索看板（单页）"],
  state: ["客户线索列表", "客户、联系人和线索阶段字段"],
  constraints: [
    "使用原生 HTML、CSS 和 JavaScript",
    "不使用外部依赖或网络请求",
    "生成文档小于 50 KB",
  ],
  html: leadBoardAppHtml,
};

function projectName(context: AgentContext) {
  return context.goal.trim() || "你的产品";
}

function chooseDemoTemplate(goal: string): DemoTemplate {
  const normalizedGoal = goal.toLowerCase();

  if (/内容|日历|选题|发布计划|content|calendar/u.test(normalizedGoal)) {
    return contentCalendarTemplate;
  }

  if (/线索|销售|客户看板|lead|crm|pipeline/u.test(normalizedGoal)) {
    return leadBoardTemplate;
  }

  return bookingTemplate;
}

export class MockProvider implements AgentProvider {
  async generate(role: RoleId, context: AgentContext): Promise<AgentOutput> {
    const goal = projectName(context);
    const template = chooseDemoTemplate(goal);

    switch (role) {
      case "leader":
        return {
          summary: `已为“${goal}”规划默认交付团队。`,
          artifact: {
            type: "plan",
            content: {
              roles: ["pm", "architect", "engineer"],
              risks: [
                "需求范围可能超过单文件应用的交付边界",
                "演示模式使用内置模板，不调用真实模型",
                "发布前需要人工验证核心业务流程",
              ],
            },
          },
          suggestedNextAction: "按计划自动开始构建",
        };
      case "pm":
        return {
          summary: `已为“${goal}”整理${template.productSummary}的需求与验收条件。`,
          artifact: {
            type: "prd",
            content: {
              users: template.users,
              scope: template.scope,
              flow: template.flow,
              acceptance: template.acceptance,
            },
          },
          suggestedNextAction: "由架构师定义页面和状态边界",
        };
      case "architect":
        return {
          summary: `已确定${template.productSummary}的页面结构和浏览器状态。`,
          artifact: {
            type: "architecture",
            content: {
              pages: template.pages,
              state: template.state,
              constraints: template.constraints,
            },
          },
          suggestedNextAction: "由工程师生成可交互的单文件网页",
        };
      case "engineer":
        const previous = context.artifacts.find((artifact) => artifact.type === "app")?.content as { html?: string; title?: string } | undefined;
        let html = previous?.html ?? template.html;
        if (previous?.html) {
          const changes: string[] = [];
          if (/双列|两列|2列/.test(context.request)) changes.push('form{grid-template-columns:repeat(2,minmax(0,1fr))}');
          if (/绿色|绿/.test(context.request)) changes.push('button{background:#047857;border-color:#047857}');
          if (/蓝色|蓝/.test(context.request)) changes.push('button{background:#1d4ed8;border-color:#1d4ed8}');
          if (/深色|暗色|深/.test(context.request)) changes.push(':root{color:#e2e8f0;background:#0f172a}p{color:#94a3b8}input,select,.appointment,.content-item,.lead{color:#e2e8f0;background:#1e293b}');
          if (!changes.length) throw new Error("演示模式仅支持双列布局、绿色、蓝色和深色主题的迭代。任意需求请配置真实模型。");
          const style = `<style>${changes.join('')}@media(max-width:680px){form{grid-template-columns:1fr}}</style>`;
          html = html.includes('</head>') ? html.replace('</head>', style + '</head>') : style + html;
        }
        return {
          summary: previous ? "已按演示模式支持的修改生成新版本。" : `已生成可管理${template.productSummary}的独立网页应用。`,
          artifact: {
            type: "app",
            content: {
              title: previous?.title ?? template.title,
              html,
            },
          },
          suggestedNextAction: "在预览中测试添加和删除预约",
        };
      case "research":
        return {
          summary: `已整理“${goal}”的初步研究假设。`,
          artifact: {
            type: "research",
            content: {
              findings: ["摄影师需要减少跨渠道确认预约的沟通成本"],
              assumptions: ["客户愿意在线提交基础预约信息"],
            },
          },
        };
      case "data":
        return {
          summary: "已定义预约工具的基础衡量指标。",
          artifact: {
            type: "analysis",
            content: {
              metrics: ["预约创建数", "预约取消数", "预约完成率"],
              questions: ["哪些服务类型带来最多预约"],
            },
          },
        };
      case "seo":
        return {
          summary: "已给出摄影预约服务的搜索内容建议。",
          artifact: {
            type: "seo",
            content: {
              keywords: ["摄影预约", "写真预约", "摄影报价"],
              recommendations: ["为各类拍摄服务提供独立的说明页"],
            },
          },
        };
      case "growth":
        return {
          summary: "已提出首轮获客和转化实验。",
          artifact: {
            type: "growth",
            content: {
              experiments: ["在预约成功页提供转介绍优惠", "测试不同服务套餐的默认展示顺序"],
              successMetric: "每周有效预约数",
            },
          },
        };
    }
  }
}
