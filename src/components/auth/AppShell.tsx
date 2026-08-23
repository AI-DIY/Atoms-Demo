"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/client-api";
import { AuthPage } from "./AuthPage";
import { OnboardingWizard } from "./OnboardingWizard";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

export function AppShell() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void getCurrentUser().then(setUser).catch(() => setUser({ authenticated: false })).finally(() => setLoading(false)); }, []);
  if (loading) return <main className="auth-page"><p>正在加载...</p></main>;
  if (!user?.authenticated) return <AuthPage onAuthenticated={setUser} />;
  if (!user.hasModelConfig || !user.onboardingCompleted) return <OnboardingWizard user={user} onComplete={setUser} />;
  return <WorkspaceShell userEmail={user.email} />;
}
