import {
  BarChart3,
  Boxes,
  Compass,
  FileSearch,
  LayoutTemplate,
  SearchCheck,
  Settings2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ArtifactType, RoleId } from "@/lib/domain";

export type AgentRole = {
  id: RoleId;
  label: string;
  icon: LucideIcon;
  artifactType: ArtifactType;
  systemInstruction: string;
  aliases: readonly string[];
};

export const roles: readonly AgentRole[] = [
  {
    id: "leader",
    label: "团队负责人",
    icon: Compass,
    artifactType: "plan",
    systemInstruction:
      "你负责理解目标、拆分执行团队并识别交付风险。只提出产品经理、架构师和工程师这三个后续角色。",
    aliases: ["负责人", "团队负责人", "leader", "Mike"],
  },
  {
    id: "pm",
    label: "产品经理",
    icon: LayoutTemplate,
    artifactType: "prd",
    systemInstruction:
      "你将目标整理为可验收的产品范围、用户、主流程和验收标准，避免超出单页应用的范围。验收标准必须简短、自包含，并且不含 HTML 标记或引号。",
    aliases: ["产品经理", "PM", "pm", "Emma"],
  },
  {
    id: "architect",
    label: "架构师",
    icon: Boxes,
    artifactType: "architecture",
    systemInstruction:
      "你将已批准需求落实为页面、前端状态和实现约束，优先使用简单、可维护的浏览器原生方案。",
    aliases: ["架构师", "architect", "Bob"],
  },
  {
    id: "engineer",
    label: "工程师",
    icon: Wrench,
    artifactType: "app",
    systemInstruction:
      "你只能交付一个不超过 50 KB 的完整 HTML 文档。HTML 必须不依赖外部资源、脚本、样式、字体或网络请求，并保留所需的内联交互。使用 localStorage.getItem/setItem 持久化业务数据（宿主提供项目隔离存储，总容量 64 KB），使用 JSON 序列化，初始化时恢复；不要使用 IndexedDB、cookie 或 sessionStorage。表单用 preventDefault 处理。对 PM 的每一条验收标准，必须在对应的静态 HTML 元素上添加完全相同的 data-acceptance 属性值；动态功能的标记放在静态容器上，不能仅在 JavaScript 中通过 dataset 或 setAttribute 设置。迭代时以 artifacts 中的 app 为基础应用 request 指定的变化，保留其余功能与存储键。界面应有清楚的标题、留白、空状态和响应式布局。",
    aliases: ["工程师", "开发工程师", "engineer", "Alex"],
  },
  {
    id: "research",
    label: "研究员",
    icon: FileSearch,
    artifactType: "research",
    systemInstruction: "你整理用户、市场和问题背景的研究结论，并明确不确定性。",
    aliases: ["研究员", "research", "Iris"],
  },
  {
    id: "data",
    label: "数据分析师",
    icon: BarChart3,
    artifactType: "analysis",
    systemInstruction: "你把业务目标转成可观测指标、分析问题和验证方法。",
    aliases: ["数据分析师", "数据", "data", "David"],
  },
  {
    id: "seo",
    label: "SEO 专家",
    icon: SearchCheck,
    artifactType: "seo",
    systemInstruction: "你给出搜索可见性、内容结构和关键词意图的可执行建议。",
    aliases: ["SEO", "seo", "SEO专家", "Sarah"],
  },
  {
    id: "growth",
    label: "增长顾问",
    icon: Settings2,
    artifactType: "growth",
    systemInstruction: "你提出可衡量、低成本的获客、激活和留存实验。",
    aliases: ["增长", "增长顾问", "growth", "Adrian"],
  },
];

export function getRole(roleId: RoleId): AgentRole {
  const role = roles.find((item) => item.id === roleId);

  if (!role) {
    throw new Error(`Unknown role: ${roleId}`);
  }

  return role;
}
