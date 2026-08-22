export type RunEventName =
  | "run.started"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "run.awaiting_approval"
  | "run.completed"
  | "run.failed";

export function encodeRunEvent(name: RunEventName, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}
