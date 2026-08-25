"use client";

import { LogOut, Plus } from "lucide-react";
import type { CSSProperties } from "react";
import type { ArtifactType, RoleId } from "@/lib/domain";
import { roles } from "@/lib/roles";

const roleColors: Record<RoleId, string> = {
  leader: "#a6e07a",
  pm: "#ffb095",
  architect: "#c6adff",
  engineer: "#77d9d0",
  research: "#f8ce6a",
  data: "#77c5ff",
  seo: "#9ee1b4",
  growth: "#ffb6cf",
};

const artifactDescriptions: Record<ArtifactType, string> = {
  plan: "拆解与协调",
  prd: "需求与验收",
  architecture: "结构与边界",
  app: "实现与迭代",
  research: "机会与证据",
  analysis: "指标与洞察",
  seo: "搜索与内容",
  growth: "实验与触达",
};

export function ProjectSidebar({
  creating = false,
  loading,
  onCreate = () => undefined,
  title,
  email,
  onLogout,
}: {
  creating?: boolean;
  loading: boolean;
  onCreate?: () => void;
  title: string;
  email?: string;
  onLogout?: () => void;
}) {
  return (
    <div className="sidebar">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <span className="brand-name">Agent Studio</span>
          <span className="brand-subtitle">Goal to working app</span>
        </div>
      </div>

      <button className="project-button" disabled={creating} onClick={onCreate} type="button">
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
          {roles.map((role) => {
            const Icon = role.icon;

            return (
              <button
                className="role-button"
                key={role.id}
                style={{ "--role-color": roleColors[role.id] } as CSSProperties}
                type="button"
              >
                <span className="role-icon"><Icon size={14} aria-hidden /></span>
                <span className="role-copy">
                  <strong>{role.label}</strong>
                  <span>{artifactDescriptions[role.artifactType]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="provider-status">
        <i className="status-dot" aria-hidden />
        <span>{email ?? "当前用户"}</span>
      </div>
      <div className="sidebar-account-actions">
        <button className="small-button" aria-label="退出登录" title="退出登录" type="button" onClick={onLogout}><LogOut size={15} aria-hidden /></button>
      </div>
    </div>
  );
}
