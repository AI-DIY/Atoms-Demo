export const resources = [
  {
    id: "photography",
    title: "光影之间 · 摄影预约",
    category: "网站",
    kind: "portfolio",
    tag: "PHOTO STUDIO",
    description: "让作品被看见，让下一次拍摄轻松发生。",
    template: true,
    prompt:
      "创建一个精致的摄影工作室预约网站。展示作品集与服务，支持添加客户、拍摄日期、服务类型的预约，查看和删除预约，刷新后保留记录。",
  },
  {
    id: "calendar",
    title: "有序创作 · 内容日历",
    category: "生产力",
    kind: "calendar",
    tag: "CONTENT PLANNER",
    description: "在一个清晰的看板里规划每一条好内容。",
    template: true,
    prompt:
      "创建一个内容日历，支持添加标题、发布平台、日期和状态，按平台筛选，修改状态和删除内容，刷新后保留记录。",
  },
  {
    id: "sales",
    title: "增长有数 · 销售看板",
    category: "数据分析",
    kind: "analytics",
    tag: "SALES ANALYTICS",
    description: "从每一笔订单看见业务的变化。",
    template: true,
    prompt:
      "创建一个销售数据看板，支持添加客户、金额、日期的订单，汇总销售额和订单数，筛选和删除订单，刷新后保留数据。",
  },
  {
    id: "habits",
    title: "日积 · 习惯打卡",
    category: "生产力",
    kind: "habits",
    tag: "A LITTLE EVERY DAY",
    description: "把想做的事情，变成每天的小小坚持。",
    template: false,
    prompt:
      "设计一个清新简约的习惯打卡应用，支持创建习惯、今日打卡、取消打卡、统计本周完成情况以及删除习惯，用本地存储保存数据。",
  },
  {
    id: "gallery",
    title: "拾光 · 私人画廊",
    category: "原型设计",
    kind: "gallery",
    tag: "YOUR LITTLE GALLERY",
    description: "收藏颜色、形状与那些让你停留的瞬间。",
    template: false,
    prompt:
      "创建一个现代私人画廊应用，使用纯 CSS 和 SVG 生成抽象艺术作品卡片，支持收藏、分类筛选、自定义作品标题及删除，数据刷新保留，不使用外部图片。",
  },
  {
    id: "focus",
    title: "专注此刻 · 番茄时钟",
    category: "生产力",
    kind: "focus",
    tag: "MAKE ROOM TO FOCUS",
    description: "留下一点空白，专心做好眼前这一件事。",
    template: false,
    prompt:
      "创建一个温暖简约的番茄钟应用，支持 25 分钟专注计时、暂停、重置和 5 分钟休息，可添加并勾选待办任务，保存任务和已完成专注次数。",
  },
] as const;
export type Resource = (typeof resources)[number];
