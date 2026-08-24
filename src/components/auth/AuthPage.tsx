"use client";

import { LoaderCircle } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { loginUser, registerUser, type CurrentUser } from "@/lib/client-api";

export function AuthPage({ onAuthenticated }: { onAuthenticated: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const user = mode === "login"
        ? await loginUser(email, password)
        : await registerUser(email, password);
      onAuthenticated(user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败，请稍后重试");
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="账户登录">
        <div className="brand auth-brand"><div className="brand-mark">A</div><div><span className="brand-name">Agent Studio</span><span className="brand-subtitle">Goal to working app</span></div></div>
        <p className="eyebrow">{mode === "login" ? "欢迎回来" : "创建账户"}</p>
        <h1>{mode === "login" ? "登录 Agent Studio" : "开始使用 Agent Studio"}</h1>
        <p className="auth-copy">使用邮箱账户保存你的项目和模型配置。</p>
        <form aria-busy={busy} aria-label={mode === "login" ? "账户登录" : "账户注册"} className="auth-form" onSubmit={submit}>
          <label>邮箱<input autoComplete="email" disabled={busy} required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>密码<input autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={busy} minLength={8} required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? <LoaderCircle aria-hidden className="button-spinner" /> : null}
            <span>{busy ? mode === "login" ? "登录中" : "注册中" : mode === "login" ? "登录" : "注册"}</span>
          </button>
        </form>
        <button className="link-button" disabled={busy} type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
          {mode === "login" ? "还没有账户？注册" : "已有账户？登录"}
        </button>
      </section>
    </main>
  );
}
