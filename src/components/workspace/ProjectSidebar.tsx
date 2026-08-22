"use client";

import {
  BarChart3,
  Bot,
  Boxes,
  Compass,
  FileSearch,
  LayoutTemplate,
  Plus,
  SearchCheck,
  Settings2,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Role = {
  label: string;
  subtitle: string;
  color: string;
  Icon: LucideIcon;
};

const roles: Role[] = [
  { label: "团队负责人", subtitle: "拆解与协调", color: "#a6e07a", Icon: Compass },
  { label: "产品经理", subtitle: "需求与验收", color: "#ffb095", Icon: LayoutTemplate },
  { label: "架构师", subtitle: "结构与边界", color: "#c6adff", Icon: Boxes },
  { label: "工程师", subtitle: "实现与迭代", color: "#77d9d0", Icon: Wrench },
  { label: "研究员", subtitle: "机会与证据", color: "#f8ce6a", Icon: FileSearch },
  { label: "数据分析师", subtitle: "指标与洞察", color: "#77c5ff", Icon: BarChart3 },
  { label: "SEO 专家", subtitle: "搜索与内容", color: "#9ee1b4", Icon: SearchCheck },
  { label: "增长顾问", subtitle: "实验与触达", color: "#ffb6cf", Icon: Settings2 },
];

export function ProjectSidebar({ loading, title }: { loading: boolean; title: string }) {
  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <span className="brand-name">Agent Studio</span>
          <span className="brand-subtitle">Goal to working app</span>
        </div>
      </div>

      <button className="project-button" type="button">
        <Plus size={15} aria-hidden />
        新建项目
      </button>

      <section className="sidebar-section" aria-label="Project list">
        <p className="section-label">项目</p>
        <button className="project-row active" type="button">
          <i className="project-dot" aria-hidden />
          <span>
            <strong>{title}</strong>
            <span>{loading ? "正在加载" : "项目草稿"}</span>
          </span>
        </button>
      </section>

      <section className="sidebar-section" aria-label="Agent roles">
        <p className="section-label">专家团队</p>
        <div className="role-list">
          {roles.map(({ label, subtitle, color, Icon }) => (
            <button
              className="role-button"
              key={label}
              style={{ "--role-color": color } as React.CSSProperties}
              type="button"
            >
              <span className="role-icon"><Icon size={14} aria-hidden /></span>
              <span className="role-copy">
                <strong>{label}</strong>
                <span>{subtitle}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="provider-status">
        <i className="status-dot" aria-hidden />
        <span>Mock Provider 已就绪</span>
      </div>
    </div>
  );
}
