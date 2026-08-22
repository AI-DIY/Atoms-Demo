"use client";

import { Code2, Eye, RefreshCw, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";

const bookingHtml = (accent: string) => `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>光影预约</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; color: #1f2d23; background: #f7f8f4; font-family: system-ui, sans-serif; }
      header { display: flex; justify-content: space-between; align-items: center; padding: 22px 28px; background: #ffffff; border-bottom: 1px solid #e3e8df; }
      .brand { font-weight: 800; letter-spacing: .02em; }
      .tag { padding: 5px 9px; color: #ffffff; background: ${accent}; border-radius: 999px; font-size: 12px; }
      main { max-width: 720px; margin: 0 auto; padding: 28px; }
      h1 { margin: 0 0 6px; font-size: 27px; } p { color: #5e6a60; line-height: 1.6; }
      form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; margin: 24px 0; padding: 16px; border: 1px solid #dce5d9; border-radius: 12px; background: #ffffff; }
      input { width: 100%; padding: 10px; border: 1px solid #cdd9ca; border-radius: 7px; font: inherit; }
      button { padding: 10px 14px; border: 0; border-radius: 7px; color: #ffffff; background: ${accent}; font: inherit; font-weight: 700; cursor: pointer; }
      ul { display: grid; gap: 8px; padding: 0; list-style: none; }
      li { display: flex; align-items: center; justify-content: space-between; padding: 13px; border: 1px solid #e0e7dc; border-radius: 9px; background: #ffffff; }
      li button { padding: 5px 8px; color: #8a3d33; background: #fff0ea; font-size: 12px; }
      @media (max-width: 560px) { form { grid-template-columns: 1fr; } main { padding: 20px; } }
    </style>
  </head>
  <body>
    <header><span class="brand">光影预约</span><span class="tag">今日 3 个时段</span></header>
    <main>
      <h1>安排下一次拍摄</h1>
      <p>记录客户与意向时段，让预约跟进保持清晰。</p>
      <form id="booking-form">
        <input id="client" aria-label="客户姓名" placeholder="客户姓名" required>
        <input id="slot" aria-label="意向时段" placeholder="例如：周六 14:00" required>
        <button type="submit">添加预约</button>
      </form>
      <ul id="bookings"><li><span><strong>林小姐</strong> · 周日 10:00</span><button type="button">移除</button></li></ul>
    </main>
    <script>
      const list = document.querySelector("#bookings");
      const form = document.querySelector("#booking-form");
      list.addEventListener("click", (event) => { if (event.target.tagName === "BUTTON") event.target.closest("li").remove(); });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const client = document.querySelector("#client");
        const slot = document.querySelector("#slot");
        const item = document.createElement("li");
        const text = document.createElement("span");
        const strong = document.createElement("strong");
        const remove = document.createElement("button");
        strong.textContent = client.value;
        text.append(strong, " · " + slot.value);
        remove.type = "button"; remove.textContent = "移除";
        item.append(text, remove); list.append(item); form.reset();
      });
    </script>
  </body>
</html>`;

const versions = [
  { id: "V1", label: "Version V1", html: bookingHtml("#346f54") },
  { id: "V2", label: "Version V2", html: bookingHtml("#8a5d9f") },
];

export function PreviewPanel({ projectTitle }: { projectTitle: string }) {
  const [selectedVersion, setSelectedVersion] = useState("V1");
  const [selectedTab, setSelectedTab] = useState<"preview" | "code" | "versions">("preview");
  const active = versions.find((version) => version.id === selectedVersion) ?? versions[0];
  const safeHtml = useMemo(() => sanitizeGeneratedHtml(active.html), [active.html]);

  return (
    <div className="preview-region">
      <header className="preview-header">
        <div>
          <p className="eyebrow">应用工作台</p>
          <h2 className="preview-title">{projectTitle}</h2>
        </div>
        <div className="preview-actions">
          <span className="version-chip">{active.label}</span>
          <button className="small-button" title="刷新预览" type="button"><RefreshCw aria-hidden /></button>
          <button className="small-button" title="移动端预览" type="button"><Smartphone aria-hidden /></button>
        </div>
      </header>

      <nav aria-label="Workspace views" className="preview-tabs">
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
            <p>每次应用工程师修改都会生成一个可恢复的快照。</p>
            <div className="version-list">
              {versions.map((version) => (
                <button
                  aria-pressed={version.id === selectedVersion}
                  className="version-button"
                  key={version.id}
                  onClick={() => { setSelectedVersion(version.id); setSelectedTab("preview"); }}
                  type="button"
                >
                  <span>{version.id}</span>
                  <small>{version.id === "V1" ? "初始团队构建" : "界面风格迭代"}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="preview-footer">
        {versions.map((version) => (
          <button
            aria-pressed={version.id === selectedVersion}
            className="version-switch"
            key={version.id}
            onClick={() => setSelectedVersion(version.id)}
            type="button"
          >
            {version.id}
          </button>
        ))}
      </div>
    </div>
  );
}
