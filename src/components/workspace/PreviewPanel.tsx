"use client";

import {
  Code2,
  Eye,
  RefreshCw,
  Smartphone,
  Download,
  Rocket,
  Sparkles,
  Maximize2,
  Minimize2,
  Save,
  Copy,
  Check,
  X,
  History,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";
import { VersionPanel, type WorkspaceVersion } from "./VersionPanel";
import { AppFrame } from "./AppFrame";
import { publishProject, saveProjectCode } from "@/lib/client-api";
import { copyText } from "@/lib/clipboard";

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
  const [selectedTab, setSelectedTab] = useState<
    "preview" | "code" | "versions"
  >("preview");
  const [mobile, setMobile] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [copied, setCopied] = useState(false);
  const activeVersion = onRestore ? currentVersion : selectedVersion;
  const active = versions.find((version) => version.version === activeVersion);
  const safeHtml = useMemo(
    () => sanitizeGeneratedHtml(active?.html ?? ""),
    [active?.html],
  );

  useEffect(() => {
    setSelectedVersion(currentVersion);
  }, [currentVersion]);
  useEffect(() => {
    setCode(safeHtml);
    setCodeError("");
  }, [safeHtml]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  async function saveCode() {
    if (!projectId || savingCode || busy) return;
    setSavingCode(true);
    setCodeError("");
    try {
      await saveProjectCode(projectId, code, activeVersion);
      onPublished?.();
      setSelectedTab("preview");
    } catch (error) {
      setCodeError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingCode(false);
    }
  }

  async function publish(unpublish = false) {
    if (!projectId || publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
      await publishProject(projectId, unpublish);
      onPublished?.();
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([safeHtml], { type: "text/html;charset=utf-8" }),
    );
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
    <div className={`preview-region${expanded ? " is-expanded" : ""}`}>
      <header className="preview-header">
        <div>
          <h2 className="preview-title">
            <Code2 size={16} />
            {projectId ? "应用编辑器" : projectTitle}
          </h2>
          {projectId ? (
            <span className="preview-project-name">{projectTitle}</span>
          ) : null}
        </div>
        <div className="preview-actions">
          <span className="version-chip">
            {active ? "V" + active.version : "尚无版本"}
          </span>
          <button
            className="small-button"
            disabled={!active}
            title="刷新预览"
            onClick={() => setRefresh((value) => value + 1)}
            type="button"
          >
            <RefreshCw aria-hidden />
          </button>
          <button
            className="small-button"
            aria-pressed={mobile}
            title="移动端预览"
            onClick={() => setMobile(!mobile)}
            type="button"
          >
            <Smartphone aria-hidden />
          </button>
          <button
            className="small-button"
            title={expanded ? "退出专注预览" : "专注预览"}
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </button>
        </div>
      </header>

      <nav aria-label="工作台视图" className="preview-tabs">
        <button
          className={"tab " + (selectedTab === "preview" ? "active" : "")}
          onClick={() => setSelectedTab("preview")}
          type="button"
        >
          <Eye size={13} aria-hidden /> 预览
        </button>
        <button
          className={"tab " + (selectedTab === "code" ? "active" : "")}
          onClick={() => setSelectedTab("code")}
          type="button"
        >
          <Code2 size={13} aria-hidden /> 代码
        </button>
        <button
          className={"tab " + (selectedTab === "versions" ? "active" : "")}
          onClick={() => setSelectedTab("versions")}
          type="button"
        >
          <History size={13} aria-hidden />
          版本
        </button>
        <button
          className="tab"
          disabled={!active}
          onClick={download}
          type="button"
        >
          <Download size={13} aria-hidden /> 下载 HTML
        </button>
        {projectId ? (
          <button
            className="tab publish-trigger"
            disabled={!active || busy}
            onClick={() => setShareOpen(!shareOpen)}
            type="button"
          >
            <Rocket size={13} aria-hidden /> 发布
          </button>
        ) : null}
      </nav>

      {shareOpen ? (
        <section className="publish-panel" aria-label="发布应用">
          <div className="publish-heading">
            <strong>
              {shareToken
                ? `线上版本 V${publishedVersion}`
                : "将当前应用发布为公开链接"}
            </strong>
            <button
              className="icon-button"
              title="关闭发布面板"
              onClick={() => setShareOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p>
            访客可以使用发布的应用；对话、账户和工作区业务数据不会公开。后续修改需再次发布才会更新链接。
          </p>
          {shareToken ? (
            <a href={`/share/${shareToken}`} target="_blank" rel="noreferrer">
              打开公开应用 ↗
            </a>
          ) : null}
          {shareToken ? (
            <div className="share-url">
              <input
                aria-label="公开应用链接"
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${shareToken}`}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="icon-button"
                aria-label={copied ? "链接已复制" : "复制公开链接"}
                onClick={() =>
                  void copyText(`${window.location.origin}/share/${shareToken}`)
                    .then(() => setCopied(true))
                    .catch((error) => setPublishError(error.message))
                }
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          ) : null}
          <div className="publish-controls">
            <button
              className="primary-button"
              disabled={publishing || busy}
              onClick={() => void publish()}
              type="button"
            >
              {publishing
                ? "处理中…"
                : shareToken
                  ? `更新到 V${currentVersion}`
                  : "确认公开发布"}
            </button>
            {shareToken ? (
              <button
                className="secondary-button"
                disabled={publishing}
                onClick={() => void publish(true)}
                type="button"
              >
                取消发布
              </button>
            ) : null}
          </div>
          {publishError ? <p role="alert">{publishError}</p> : null}
        </section>
      ) : null}

      <div className="preview-stage">
        {selectedTab === "preview" ? (
          <div className={"preview-window" + (mobile ? " mobile-preview" : "")}>
            <div className="preview-address">
              <span className="address-lights" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              <span>
                {mobile ? "移动端 · 390px" : "应用预览"} ·{" "}
                {active ? `V${active.version}` : "等待首次构建"}
              </span>
            </div>
            {active ? (
              <AppFrame
                key={`${projectId}-${active.version}-${refresh}`}
                html={active.html}
                storageUrl={
                  projectId ? `/api/projects/${projectId}/state` : undefined
                }
              />
            ) : (
              <div className="preview-placeholder">
                <div>
                  <Sparkles />
                  <h2>让想法在这里运行</h2>
                  <p>
                    在左侧描述产品目标，智能体会依次完成规划、设计和代码生成。完成后即可在这里操作应用。
                  </p>
                  <span className="empty-steps">
                    01 描述目标　02 团队构建　03 体验与发布
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : null}
        {selectedTab === "code" ? (
          <div className="code-editor">
            <header>
              <span>
                <Code2 size={15} /> index.html{" "}
                <small>{code !== safeHtml ? "未保存" : "已保存"}</small>
              </span>
              <div>
                <button
                  className="text-button"
                  disabled={code === safeHtml || savingCode}
                  onClick={() => {
                    setCode(safeHtml);
                    setCodeError("");
                  }}
                >
                  还原修改
                </button>
                {projectId ? (
                  <button
                    className="primary-button compact"
                    disabled={
                      !active || busy || savingCode || code === safeHtml
                    }
                    onClick={() => void saveCode()}
                  >
                    <Save size={14} />
                    {savingCode ? "保存中…" : "保存新版本"}
                  </button>
                ) : null}
              </div>
            </header>
            {active ? (
              <textarea
                className="code-view"
                aria-label="HTML 源码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                readOnly={!projectId || busy || savingCode}
                maxLength={50000}
              />
            ) : (
              <div className="empty-state">
                <Code2 />
                <p>首次构建完成后，可以在这里编辑源码。</p>
              </div>
            )}
            <footer>
              <span>
                {new TextEncoder().encode(code).length.toLocaleString()} /
                50,000 bytes
              </span>
              <span>保存后生成独立版本 · 发布需单独更新</span>
            </footer>
            {codeError ? (
              <p className="form-error" role="alert">
                {codeError}
              </p>
            ) : null}
          </div>
        ) : null}
        {selectedTab === "versions" ? (
          <div className="versions-view">
            <h3>版本历史</h3>
            <p>
              选择版本恢复到该成果；后续版本仍保留，业务数据和已发布版本不受影响。
            </p>
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
