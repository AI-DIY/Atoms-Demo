import type { ProjectEvent, ProjectStatus } from "@/lib/domain";

const transitions: Record<
  ProjectStatus,
  Partial<Record<ProjectEvent, ProjectStatus>>
> = {
  draft: { plan: "planning" },
  planning: { complete: "awaiting_approval", fail: "failed" },
  awaiting_approval: { approve: "building", fail: "failed" },
  building: { review: "reviewing", fail: "failed" },
  reviewing: { complete: "ready", fail: "failed" },
  ready: { iterate: "iterating" },
  iterating: { complete: "ready", fail: "failed" },
  failed: { retry: "planning" },
};

export function transitionProject(
  from: ProjectStatus,
  event: ProjectEvent,
): ProjectStatus {
  const next = transitions[from][event];

  if (!next) {
    throw new Error(`Invalid transition: ${from} -> ${event}`);
  }

  return next;
}

