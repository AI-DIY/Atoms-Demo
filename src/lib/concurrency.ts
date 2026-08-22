export type Release = () => void;

export class ConcurrencyGate {
  private active = 0;

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Concurrency limit must be at least 1");
    }
  }

  async acquire(): Promise<Release> {
    if (this.active >= this.limit) {
      throw new Error("Server is busy");
    }

    this.active += 1;
    let released = false;

    return () => {
      if (released) return;

      released = true;
      this.active = Math.max(0, this.active - 1);
    };
  }
}
