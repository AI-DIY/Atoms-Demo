export type JsonRequestBodyResult =
  | { kind: "invalid" }
  | { kind: "tooLarge" }
  | { kind: "json"; body: unknown };

export async function readBoundedJsonBody(
  request: Request,
  maxBytes: number,
): Promise<JsonRequestBodyResult> {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { kind: "tooLarge" };
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return { kind: "invalid" };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;

      if (byteLength > maxBytes) {
        await reader.cancel();
        return { kind: "tooLarge" };
      }

      chunks.push(value);
    }
  } catch {
    return { kind: "invalid" };
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { kind: "json", body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { kind: "invalid" };
  }
}
