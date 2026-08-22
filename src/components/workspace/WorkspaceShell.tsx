"use client";

import { ConversationPanel } from "./ConversationPanel";
import { PreviewPanel } from "./PreviewPanel";
import { ProjectSidebar } from "./ProjectSidebar";

export function WorkspaceShell() {
  return (
    <main className="workspace">
      <aside aria-label="Projects" className="sidebar">
        <ProjectSidebar />
      </aside>
      <section aria-label="Agent conversation" className="conversation">
        <ConversationPanel />
      </section>
      <section aria-label="Application preview" className="preview-region">
        <PreviewPanel />
      </section>
    </main>
  );
}

