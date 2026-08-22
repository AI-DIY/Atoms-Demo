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
    aliases: ["负责人", "团队负责人", "leader"],
  },
  {
    id: "pm",
    label: "产品经理",
    icon: LayoutTemplate,
    artifactType: "prd",
    systemInstruction:
      "你将目标整理为可验收的产品范围、用户、主流程和验收标准，避免超出单页应用的范围。",
    aliases: ["产品经理", "PM", "pm"],
  },
  {
    id: "architect",
    label: "架构师",
    icon: Boxes,
    artifactType: "architecture",
    systemInstruction:
      "你将已批准需求落实为页面、前端状态和实现约束，优先使用简单、可维护的浏览器原生方案。",
    aliases: ["架构师", "architect"],
  },
  {
    id: "engineer",
    label: "工程师",
    icon: Wrench,
    artifactType: "app",
    systemInstruction:
      "你只能交付一个不超过 50 KB 的完整 HTML 文档。HTML 必须不依赖外部资源、脚本、样式、字体或网络请求，并保留所需的内联交互。",
    aliases: ["工程师", "开发工程师", "engineer"],
  },
  {
    id: "research",
    label: "研究员",
    icon: FileSearch,
    artifactType: "research",
    systemInstruction: "你整理用户、市场和问题背景的研究结论，并明确不确定性。",
    aliases: ["研究员", "research"],
  },
  {
    id: "data",
    label: "数据分析师",
    icon: BarChart3,
    artifactType: "analysis",
    systemInstruction: "你把业务目标转成可观测指标、分析问题和验证方法。",
    aliases: ["数据分析师", "数据", "data"],
  },
  {
    id: "seo",
    label: "SEO 专家",
    icon: SearchCheck,
    artifactType: "seo",
    systemInstruction: "你给出搜索可见性、内容结构和关键词意图的可执行建议。",
    aliases: ["SEO", "seo", "SEO专家"],
  },
  {
    id: "growth",
    label: "增长顾问",
    icon: Settings2,
    artifactType: "growth",
    systemInstruction: "你提出可衡量、低成本的获客、激活和留存实验。",
    aliases: ["增长", "增长顾问", "growth"],
  },
];

export function getRole(roleId: RoleId): AgentRole {
  const role = roles.find((item) => item.id === roleId);

  if (!role) {
    throw new Error(`Unknown role: ${roleId}`);
  }

  return role;
}
