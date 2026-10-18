"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildAppDocument } from "@/lib/app-runtime";
import { isAppState, type AppState } from "@/lib/app-state";

export function AppFrame({ html, storageUrl, visitorKey }: { html: string; storageUrl?: string; visitorKey?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [initial, setInitial] = useState<AppState | null>(storageUrl || visitorKey ? null : {});
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [runtimeError, setRuntimeError] = useState("");
  const document = useMemo(() => initial ? buildAppDocument(html, initial) : "", [html, initial]);

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        let data: unknown = {};
        if (storageUrl) {
          const response = await fetch(storageUrl);
          if (!response.ok) throw new Error("无法加载应用数据，请刷新预览重试。");
          data = await response.json();
        } else if (visitorKey) {
          data = JSON.parse(localStorage.getItem(visitorKey) ?? "{}");
        }
        if (!isAppState(data)) throw new Error("应用数据格式无效");
        if (!disposed) setInitial(data);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : "无法读取应用数据");
      }
    }
    void load();
    return () => { disposed = true; };
  }, [storageUrl, visitorKey]);

  useEffect(() => {
    let pending: AppState | null = null;
    let saving = false;
    let disposed = false;
    async function flush() {
      if (saving) return;
      saving = true;
      while (pending) {
        const next = pending;
        pending = null;
        try {
          if (storageUrl) {
            const response = await fetch(storageUrl, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next), keepalive: true });
            if (!response.ok) throw new Error("保存失败，请检查网络后再次操作。");
          } else if (visitorKey) {
            localStorage.setItem(visitorKey, JSON.stringify(next));
          }
          if (!disposed) { setStatus(storageUrl ? "应用数据已保存" : "数据已保存在此浏览器"); setError(""); }
        } catch {
          if (!disposed) { setStatus(""); setError("应用数据保存失败，请检查网络与存储空间。"); }
        }
      }
      saving = false;
    }
    function receive(event: MessageEvent) {
      // The opaque-origin iframe is identified by its WindowProxy, never by a claimed project ID.
      if (event.source !== frame.current?.contentWindow || !event.data) return;
      if (event.data.type === "agent-studio:error") setRuntimeError(String(event.data.message).slice(0, 300));
      if (event.data.type !== "agent-studio:state" || !isAppState(event.data.state)) return;
      pending = event.data.state;
      setStatus("正在保存应用数据…");
      void flush();
    }
    window.addEventListener("message", receive);
    return () => { disposed = true; window.removeEventListener("message", receive); };
  }, [storageUrl, visitorKey]);

  return <>
    {initial ? <iframe ref={frame} className="generated-frame" sandbox="allow-scripts allow-forms allow-modals" srcDoc={document} title="Generated application" /> : <p className="runtime-status">正在加载应用数据…</p>}
    {status ? <p className="runtime-status" role="status">{status}</p> : null}
    {error ? <p className="runtime-error" role="alert">{error}</p> : null}
    {runtimeError ? <p className="runtime-error" role="alert">应用运行错误：{runtimeError}。可在对话中描述问题并请求修复。</p> : null}
  </>;
}
