import { describe, expect, it } from "vitest";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";

describe("sanitizeGeneratedHtml", () => {
  it("removes external escape hatches while keeping inline interaction", () => {
    const safe = sanitizeGeneratedHtml(
      '<base href="https://bad.test"><script src="https://bad.test/a.js"></script><form action="https://bad.test"></form><script>document.body.dataset.ok="1"</script>',
    );

    expect(safe).not.toContain("https://bad.test");
    expect(safe).toContain("dataset.ok");
  });
});

