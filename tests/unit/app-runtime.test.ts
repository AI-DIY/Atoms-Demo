import { describe, expect, it } from "vitest";
import { buildAppDocument } from "@/lib/app-runtime";
import { isAppState } from "@/lib/app-state";

describe("isolated application runtime", () => {
  it("places network-denying policy before generated code and escapes saved data", () => {
    const html = buildAppDocument('<html><head><script>doWork()</script></head><body>App</body></html>', { evil: '</script><script>alert(1)</script>' });
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("doWork"));
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });
  it("limits keys, value types and UTF-8 payload size", () => {
    expect(isAppState({ item: "stored" })).toBe(true);
    expect(isAppState({ item: 42 })).toBe(false);
    expect(isAppState([])).toBe(false);
    expect(isAppState({ item: "中".repeat(23_000) })).toBe(false);
  });
});
