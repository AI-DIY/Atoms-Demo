"use client";

import { useEffect, useState } from "react";
import { createProject, loadProject, type LoadedProject } from "@/lib/client-api";
import { defaultProject } from "@/lib/default-project";
import { restoreOrCreateProject } from "@/lib/project-session";
import { ConversationPanel } from "./ConversationPanel";
import { PreviewPanel } from "./PreviewPanel";
import { ProjectSidebar } from "./ProjectSidebar";

export function WorkspaceShell() {
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void restoreOrCreateProject({
      storage: window.localStorage,
      api: { createProject, loadProject },
      defaultProject,
    })
      .then((loadedProject) => {
        if (!cancelled) {
          setProject(loadedProject);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("项目暂时无法加载，请刷新后重试。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const title = project?.title ?? "正在加载项目";
  const goal = project?.goal ?? "正在获取项目目标，请稍候。";

  return (
    <main className="workspace">
      <aside aria-label="Projects" className="sidebar">
        <ProjectSidebar loading={!project && !loadError} title={title} />
      </aside>
      <section aria-label="Agent conversation" className="conversation">
        <ConversationPanel
          error={loadError}
          loading={!project && !loadError}
          projectGoal={goal}
          projectTitle={title}
        />
      </section>
      <section aria-label="Application preview" className="preview-region">
        <PreviewPanel projectTitle={title} />
      </section>
    </main>
  );
}
