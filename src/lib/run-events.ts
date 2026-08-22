export type RunEventName =
  | "run.started"
  | "step.started"
  | "step.completed"
  | "step.failed"
  | "run.awaiting_approval"
  | "run.completed"
  | "run.failed";

export type RunEventEmitter = (name: RunEventName, data: unknown) => void;

export function encodeRunEvent(name: RunEventName, data: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function streamRunEvents(
  runId: string,
  producer: (emit: RunEventEmitter) => Promise<void>,
) {
  const encoder = new TextEncoder();
  let consumerCancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit: RunEventEmitter = (name, data) => {
        if (consumerCancelled) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(encodeRunEvent(name, data)));
        } catch {
          consumerCancelled = true;
        }
      };

      void producer(emit)
        .catch(() => {
          emit("run.failed", { runId, error: "运行失败" });
        })
        .finally(() => {
          if (consumerCancelled) {
            return;
          }

          try {
            controller.close();
          } catch {
            consumerCancelled = true;
          }
        });
    },
    cancel() {
      consumerCancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    },
  });
}
