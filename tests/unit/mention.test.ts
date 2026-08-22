import { describe, expect, it } from "vitest";
import { parseFirstMention } from "@/lib/mention";

describe("parseFirstMention", () => {
  it("routes an architect alias", () => {
    expect(parseFirstMention("@架构师 设计移动导航")).toBe("architect");
  });

  it("routes only the first mention token", () => {
    expect(parseFirstMention("@产品经理 然后请 @工程师实现")).toBe("pm");
  });

  it("does not route ordinary messages or unknown first mentions", () => {
    expect(parseFirstMention("设计移动导航")).toBeNull();
    expect(parseFirstMention("@未知专家 请 @工程师实现")).toBeNull();
  });
});
