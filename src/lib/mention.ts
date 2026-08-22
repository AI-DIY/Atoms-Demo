import type { RoleId } from "@/lib/domain";
import { roles } from "@/lib/roles";

export function parseFirstMention(content: string): RoleId | null {
  const match = content.match(/@([^\s，,。.!！?？]+)/u);

  if (!match) {
    return null;
  }

  return roles.find((role) => role.aliases.includes(match[1]))?.id ?? null;
}
