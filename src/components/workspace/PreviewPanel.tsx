"use client";

import { Code2, Eye, RefreshCw, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";
import { VersionPanel, type WorkspaceVersion } from "./VersionPanel";

export function PreviewPanel({
  currentVersion = 0,
  onRestore,
  projectTitle,
  restoreError = null,
  restoring = false,
  versions = [],
}: {
  currentVersion?: number;
  onRestore?: (versionId: string) => void;
  projectTitle: string;
  restoreError?: string | null;
  restoring?: boolean;
  versions?: WorkspaceVersion[];
}) {
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);
  const [selectedTab, setSelectedTab] = useState<"preview" | "code" | "versions">("preview");
  const activeVersion = onRestore ? currentVersion : selectedVersion;
  const active = versions.find((version) => version.version === activeVersion);
  const safeHtml = useMemo(
    () => sanitizeGeneratedHtml(active?.html ?? ""),
    [active?.html],
  );

  useEffect(() => {
    setSelectedVersion(currentVersion);
  }, [currentVersion]);

  function selectVersion(version: number) {
    if (onRestore) {
      const target = versions.find((item) => item.version === version);

      if (target) {
        setSelectedTab("preview");
        onRestore(target.id);
      }

      return;
    }

    setSelectedVersion(version);
    setSelectedTab("preview");
  }

  return (
    <div className="preview-region">
      <header className="preview-header">
        <div>
          <p className="eyebrow">应用工作台</p>
          <h2 className="preview-title">{projectTitle}</h2>
        </div>
        <div className="preview-actions">
          <span className="version-chip">{active ? "V" + active.version : "尚无版本"}</span>
          <button className="small-button" title="刷新预览" type="button"><RefreshCw aria-hidden /></button>
          <button className="small-button" title="移动端预览" type="button"><Smartphone aria-hidden /></button>
        </div>
      </header>

      <nav aria-label="工作台视图" className="preview-tabs">
        <button className={"tab " + (selectedTab === "preview" ? "active" : "")} onClick={() => setSelectedTab("preview")} type="button"><Eye size={13} aria-hidden /> 预览</button>
        <button className={"tab " + (selectedTab === "code" ? "active" : "")} onClick={() => setSelectedTab("code")} type="button"><Code2 size={13} aria-hidden /> 代码</button>
        <button className={"tab " + (selectedTab === "versions" ? "active" : "")} onClick={() => setSelectedTab("versions")} type="button">版本</button>
      </nav>

      <div className="preview-stage">
        {selectedTab === "preview" ? (
          <div className="preview-window">
            <div className="preview-address">
              <span className="address-lights" aria-hidden><i /><i /><i /></span>
              <span>preview.agent-studio.local</span>
            </div>
            <iframe className="generated-frame" sandbox="allow-scripts" srcDoc={safeHtml} title="Generated application" />
          </div>
        ) : null}
        {selectedTab === "code" ? <pre className="code-view">{safeHtml}</pre> : null}
        {selectedTab === "versions" ? (
          <div className="versions-view">
            <h3>版本历史</h3>
            <p>选择任一已保存版本以查看对应应用。</p>
            <VersionPanel
              currentVersion={currentVersion}
              error={restoreError}
              onSelect={selectVersion}
              restoring={restoring}
              versions={versions}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
