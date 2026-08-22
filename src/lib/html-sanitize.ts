const MAX_HTML_BYTES = 50_000;

export function sanitizeGeneratedHtml(input: string): string {
  if (new TextEncoder().encode(input).byteLength > MAX_HTML_BYTES) {
    throw new Error("Generated HTML exceeds 50 KB");
  }

  return input
    .replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/\saction=["'][^"']*["']/gi, "")
    .replace(/https?:\/\/[^"'\s)>]+/gi, "");
}

