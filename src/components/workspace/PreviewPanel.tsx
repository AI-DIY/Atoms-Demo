"use client";

import { Code2, Eye, RefreshCw, Smartphone, Download, Rocket, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";
import { VersionPanel, type WorkspaceVersion } from "./VersionPanel";
import { AppFrame } from "./AppFrame";
import { publishProject } from "@/lib/client-api";

export function PreviewPanel({
  currentVersion = 0,
  onRestore,
  projectTitle,
  restoreError = null,
  restoring = false,
  versions = [],
  projectId,
  shareToken,
  publishedVersion,
  onPublished,
  busy = false,
}: {
  currentVersion?: number;
  onRestore?: (versionId: string) => void;
  projectTitle: string;
  restoreError?: string | null;
  restoring?: boolean;
  versions?: WorkspaceVersion[];
  projectId?: string;
  shareToken?: string | null;
  publishedVersion?: number | null;
  onPublished?: () => void;
  busy?: boolean;
}) {
  const [selectedVersion, setSelectedVersion] = useState(currentVersion);
  const [selectedTab, setSelectedTab] = useState<"preview" | "code" | "versions">("preview");
  const [mobile, setMobile] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const activeVersion = onRestore ? currentVersion : selectedVersion;
  const active = versions.find((version) => version.version === activeVersion);
  const safeHtml = useMemo(
    () => sanitizeGeneratedHtml(active?.html ?? ""),
    [active?.html],
  );

  useEffect(() => {
    setSelectedVersion(currentVersion);
  }, [currentVersion]);

  async function publish(unpublish = false) {
    if (!projectId || publishing) return;
    setPublishing(true);
    setPublishError("");
    try { await publishProject(projectId, unpublish); onPublished?.(); }
    catch (error) { setPublishError(error instanceof Error ? error.message : "发布失败"); }
    finally { setPublishing(false); }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([safeHtml], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `agent-studio-v${activeVersion}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

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
          <button className="small-button" disabled={!active} title="刷新预览" onClick={() => setRefresh((value) => value + 1)} type="button"><RefreshCw aria-hidden /></button>
          <button className="small-button" aria-pressed={mobile} title="移动端预览" onClick={() => setMobile(!mobile)} type="button"><Smartphone aria-hidden /></button>
        </div>
      </header>

      <nav aria-label="工作台视图" className="preview-tabs">
        <button className={"tab " + (selectedTab === "preview" ? "active" : "")} onClick={() => setSelectedTab("preview")} type="button"><Eye size={13} aria-hidden /> 预览</button>
        <button className={"tab " + (selectedTab === "code" ? "active" : "")} onClick={() => setSelectedTab("code")} type="button"><Code2 size={13} aria-hidden /> 代码</button>
        <button className={"tab " + (selectedTab === "versions" ? "active" : "")} onClick={() => setSelectedTab("versions")} type="button">版本</button>
        <button className="tab" disabled={!active} onClick={download} type="button"><Download size={13} aria-hidden /> 下载 HTML</button>
        {projectId ? <button className="tab publish-trigger" disabled={!active || busy} onClick={() => setShareOpen(!shareOpen)} type="button"><Rocket size={13} aria-hidden /> 发布</button> : null}
      </nav>

      {shareOpen ? <section className="publish-panel" aria-label="发布应用">
        <strong>{shareToken ? `线上版本 V${publishedVersion}` : "将当前应用发布为公开链接"}</strong>
        <p>访客可以使用发布的应用；对话、账户和工作区业务数据不会公开。后续修改需再次发布才会更新链接。</p>
        {shareToken ? <a href={`/share/${shareToken}`} target="_blank" rel="noreferrer">打开公开应用 ↗</a> : null}
        <div className="publish-controls">
          <button className="primary-button" disabled={publishing || busy} onClick={() => void publish()} type="button">{publishing ? "处理中…" : shareToken ? `更新到 V${currentVersion}` : "确认公开发布"}</button>
          {shareToken ? <button className="secondary-button" disabled={publishing} onClick={() => void publish(true)} type="button">取消发布</button> : null}
        </div>
        {publishError ? <p role="alert">{publishError}</p> : null}
      </section> : null}

      <div className="preview-stage">
        {selectedTab === "preview" ? (
          <div className={"preview-window" + (mobile ? " mobile-preview" : "")}>
            <div className="preview-address">
              <span className="address-lights" aria-hidden><i /><i /><i /></span>
              <span>{mobile ? "移动端 · 390px" : "应用预览"} · {active ? `V${active.version}` : "等待首次构建"}</span>
            </div>
            {active ? <AppFrame key={`${projectId}-${active.version}-${refresh}`} html={active.html} storageUrl={projectId ? `/api/projects/${projectId}/state` : undefined} /> : <div className="preview-placeholder"><div><Sparkles /><h2>让想法在这里运行</h2><p>在左侧描述产品目标，智能体会依次完成规划、设计和代码生成。完成后即可在这里操作应用。</p><span className="empty-steps">01 描述目标　02 团队构建　03 体验与发布</span></div></div>}
          </div>
        ) : null}
        {selectedTab === "code" ? <pre className="code-view">{safeHtml}</pre> : null}
        {selectedTab === "versions" ? (
          <div className="versions-view">
            <h3>版本历史</h3>
            <p>选择版本恢复到该成果；后续版本仍保留，业务数据和已发布版本不受影响。</p>
            <VersionPanel
              currentVersion={currentVersion}
              error={restoreError}
              onSelect={selectVersion}
              restoring={restoring || busy}
              versions={versions}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
