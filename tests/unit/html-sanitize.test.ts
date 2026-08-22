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

  it("removes refresh navigation and dangerous URL schemes without removing inline code", () => {
    const safe = sanitizeGeneratedHtml(
      '<meta http-equiv="refresh" content="0; url=https://bad.test"><a href="//bad.test/next">outside</a><a href="javascript:alert(1)">script link</a><img src="data:image/svg+xml;base64,abc"><script>document.body.dataset.ok="1";</script>',
    );

    expect(safe).not.toContain("http-equiv");
    expect(safe).not.toContain("//bad.test");
    expect(safe).not.toContain("javascript:");
    expect(safe).not.toContain("data:image");
    expect(safe).toContain("dataset.ok");
  });

  it("handles malformed numeric entities without failing the sanitizer", () => {
    expect(() =>
      sanitizeGeneratedHtml('<a href="jav&#x110000;ascript:alert(1)">outside</a>'),
    ).not.toThrow();
  });
});
