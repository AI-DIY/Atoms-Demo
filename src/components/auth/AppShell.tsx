"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/client-api";
import { StudioApp } from "@/components/studio/StudioApp";

export function AppShell() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getCurrentUser()
      .then(setUser)
      .catch(() => setUser({ authenticated: false }))
      .finally(() => setLoading(false));
  }, []);
  if (loading)
    return (
      <main className="auth-page">
        <p>正在加载...</p>
      </main>
    );
  return (
    <StudioApp
      user={user ?? { authenticated: false }}
      onAuthenticated={setUser}
    />
  );
}
