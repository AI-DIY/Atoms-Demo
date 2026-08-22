import { describe, expect, it } from "vitest";
import { ConcurrencyGate } from "@/lib/concurrency";

describe("ConcurrencyGate", () => {
  it("rejects a second acquire while its limit is occupied", async () => {
    const gate = new ConcurrencyGate(1);
    const release = await gate.acquire();

    await expect(gate.acquire()).rejects.toThrow("Server is busy");

    release();
  });

  it("accepts work after the active lease is released", async () => {
    const gate = new ConcurrencyGate(1);
    const release = await gate.acquire();

    release();

    const nextRelease = await gate.acquire();
    nextRelease();
  });

  it("makes each release idempotent", async () => {
    const gate = new ConcurrencyGate(1);
    const release = await gate.acquire();

    release();
    release();

    const nextRelease = await gate.acquire();
    await expect(gate.acquire()).rejects.toThrow("Server is busy");
    nextRelease();
  });
});
