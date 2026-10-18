export const maxAppStateBytes = 65_536;
export type AppState = Record<string, string>;

export function isAppState(value: unknown): value is AppState {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).length <= 100
    && Object.entries(value).every(([key, item]) => key.length <= 200 && typeof item === "string")
    && new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxAppStateBytes);
}
