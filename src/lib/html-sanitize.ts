const MAX_HTML_BYTES = 50_000;
const URL_ATTRIBUTE =
  /\s(?:href|src|action|formaction|poster|xlink:href|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu;
const SRCSET_ATTRIBUTE =
  /\ssrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/giu;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s'")][^)]*))\s*\)/giu;

function capturedValue(
  doubleQuoted: string | undefined,
  singleQuoted: string | undefined,
  bare: string | undefined,
) {
  return doubleQuoted ?? singleQuoted ?? bare ?? "";
}

function decodeCodePoint(value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);

  return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : "";
}

function isDangerousUrl(value: string) {
  const normalized = value
    .replace(/&#x([\da-f]+);?/giu, (_, hex: string) =>
      decodeCodePoint(hex, 16),
    )
    .replace(/&#(\d+);?/gu, (_, decimal: string) =>
      decodeCodePoint(decimal, 10),
    )
    .replace(/&colon;?/giu, ":")
    .replace(/[\u0000-\u0020]+/gu, "")
    .toLowerCase();

  return /^(?:(?:https?:)?\/\/|javascript:|data:)/u.test(normalized);
}

function containsDangerousSrcset(value: string) {
  return value.split(",").some((source) => {
    const url = source.trim().split(/\s+/u, 1)[0] ?? "";
    return isDangerousUrl(url);
  });
}

export function sanitizeGeneratedHtml(input: string): string {
  if (new TextEncoder().encode(input).byteLength > MAX_HTML_BYTES) {
    throw new Error("Generated HTML exceeds 50 KB");
  }

  return input
    .replace(
      /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"\s*refresh\s*"|'\s*refresh\s*'|refresh\b))[^>]*>/giu,
      "",
    )
    .replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/\saction=["'][^"']*["']/gi, "")
    .replace(URL_ATTRIBUTE, (match, doubleQuoted, singleQuoted, bare) =>
      isDangerousUrl(capturedValue(doubleQuoted, singleQuoted, bare)) ? "" : match,
    )
    .replace(SRCSET_ATTRIBUTE, (match, doubleQuoted, singleQuoted, bare) =>
      containsDangerousSrcset(capturedValue(doubleQuoted, singleQuoted, bare))
        ? ""
        : match,
    )
    .replace(CSS_URL, (match, doubleQuoted, singleQuoted, bare) =>
      isDangerousUrl(capturedValue(doubleQuoted, singleQuoted, bare)) ? "url()" : match,
    )
    .replace(/https?:\/\/[^"'\s)>]+/gi, "");
}
