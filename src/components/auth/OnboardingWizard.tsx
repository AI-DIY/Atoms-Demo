"use client";

import { useState } from "react";
import { completeOnboarding, type CurrentUser, type ModelConfigView } from "@/lib/client-api";
import { ModelConfigForm } from "./ModelConfigForm";

export function OnboardingWizard({ user, onComplete }: { user: CurrentUser; onComplete: (user: CurrentUser) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(2);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saved(_config: ModelConfigView) {
    setError(null);
    try { setCreated(true); setStep(3); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "初始化工作区失败"); }
  }

  return <main className="onboarding-page"><section className="onboarding-card"><div className="wizard-steps"><span className="done">1 账户</span><span className={step === 2 ? "active" : "done"}>2 模型</span><span className={step === 3 ? "active" : ""}>3 工作区</span></div>{step === 2 ? <><p className="eyebrow">步骤 2 / 3</p><h1>配置你的 Responses API 模型</h1><p className="auth-copy">{user.email}，完成模型配置后就可以开始创建项目。</p><ModelConfigForm onSaved={(config) => void saved(config)} />{error ? <p className="form-error" role="alert">{error}</p> : null}</> : <><p className="eyebrow">步骤 3 / 3</p><h1>工作区已准备好</h1><p className="auth-copy">默认项目已初始化，可以进入 Agent Studio。</p><button className="primary-button" disabled={!created} onClick={() => void completeOnboarding().then(onComplete)} type="button">进入工作区</button></>}</section></main>;
}
