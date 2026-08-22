"use client";

import { useState } from "react";
import type { ProjectInput } from "@/lib/client-api";

export function NewProjectDialog({
  creating,
  error,
  onCancel,
  onCreate,
}: {
  creating: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (input: ProjectInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ title: title.trim(), goal: goal.trim() });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={creating ? undefined : onCancel}>
      <section
        aria-labelledby="new-project-title"
        aria-modal="true"
        className="new-project-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header>
          <p className="eyebrow">新工作区</p>
          <h2 id="new-project-title">新建项目</h2>
          <p>填写目标后，由团队负责人规划下一步工作。</p>
        </header>
        <form onSubmit={submit}>
          <label>
            项目名称
            <input
              autoFocus
              disabled={creating}
              maxLength={80}
              minLength={1}
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label>
            项目目标
            <textarea
              disabled={creating}
              maxLength={2_000}
              minLength={8}
              onChange={(event) => setGoal(event.target.value)}
              required
              rows={4}
              value={goal}
            />
          </label>
          {error ? <p className="dialog-error" role="alert">{error}</p> : null}
          <footer>
            <button disabled={creating} onClick={onCancel} type="button">取消</button>
            <button className="dialog-submit" disabled={creating} type="submit">
              {creating ? "正在创建" : "创建项目"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
