"use client";

import { FormEvent, useEffect, useState } from "react";
import { loadModelConfig, saveModelConfig, testModelConfig, type ModelConfigInput, type ModelConfigView } from "@/lib/client-api";

const defaults: ModelConfigInput = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  modelId: "gpt-5.5",
  displayName: "默认模型",
  notes: "",
  maxOutputTokens: 4096,
  reasoningEffort: "medium",
};

export function ModelConfigForm({ onSaved, onCancel }: { onSaved?: (config: ModelConfigView) => void; onCancel?: () => void }) {
  const [values, setValues] = useState<ModelConfigInput>(defaults);
  const [existing, setExisting] = useState<ModelConfigView | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadModelConfig().then((config) => {
      if (!config) return;
      setExisting(config);
      const { apiKeyMasked: _apiKeyMasked, ...safeConfig } = config;
      setValues({ ...safeConfig, apiKey: "" });
    }).catch(() => undefined);
  }, []);

  function update<K extends keyof ModelConfigInput>(key: K, value: ModelConfigInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setTested(false);
  }

  async function testConnection() {
    setTesting(true); setError(null);
    try {
      await testModelConfig({ ...values, apiKey: values.apiKey || "" });
      setTested(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "连接测试失败"); }
    finally { setTesting(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const saved = await saveModelConfig(values);
      setExisting(saved);
      setValues((current) => ({ ...current, apiKey: "" }));
      onSaved?.(saved);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败"); }
    finally { setBusy(false); }
  }

  const masked = existing?.apiKeyMasked;
  return (
    <form className="model-config-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Base URL<input required type="url" value={values.baseUrl} onChange={(event) => update("baseUrl", event.target.value)} /></label>
        <label>API Key<input placeholder={masked ?? "sk-..."} type="password" value={values.apiKey} onChange={(event) => update("apiKey", event.target.value)} /></label>
        <label>模型 ID<input required value={values.modelId} onChange={(event) => update("modelId", event.target.value)} /></label>
        <label>显示名称<input required value={values.displayName} onChange={(event) => update("displayName", event.target.value)} /></label>
        <label>最大输出 Token<input min={256} max={32768} required type="number" value={values.maxOutputTokens ?? ""} onChange={(event) => update("maxOutputTokens", Number(event.target.value))} /></label>
        <label>推理强度<select value={values.reasoningEffort ?? "medium"} onChange={(event) => update("reasoningEffort", event.target.value as ModelConfigInput["reasoningEffort"])}><option value="none">无</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option></select></label>
      </div>
      <label>备注<textarea rows={3} value={values.notes ?? ""} onChange={(event) => update("notes", event.target.value)} /></label>
      <p className="field-hint">{masked ? `已保存密钥：${masked}。留空即可保留原密钥。` : "API Key 只保存在服务端，不会回显。"}</p>
      {tested ? <p className="form-success" role="status">连接测试成功，可以保存。</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button className="secondary-button" disabled={testing || !values.apiKey} type="button" onClick={() => void testConnection()}>{testing ? "测试中..." : "测试连接"}</button><button className="primary-button" disabled={busy || (!values.apiKey && !existing) || (!existing && !tested)} type="submit">{busy ? "保存中..." : "保存配置"}</button>{onCancel ? <button className="link-button" type="button" onClick={onCancel}>取消</button> : null}</div>
    </form>
  );
}
