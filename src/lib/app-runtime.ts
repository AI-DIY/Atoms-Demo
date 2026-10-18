import { sanitizeGeneratedHtml } from "./html-sanitize";
import type { AppState } from "./app-state";

export const appCsp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'";

export function buildAppDocument(html: string, initial: AppState = {}): string {
  const state = JSON.stringify(initial).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const bootstrap = `<meta http-equiv="Content-Security-Policy" content="${appCsp}"><script>
(() => {
  let values = Object.assign(Object.create(null), ${state});
  const notify = () => parent.postMessage({type:'agent-studio:state', state:values}, '*');
  const storage = {
    getItem: key => Object.prototype.hasOwnProperty.call(values, String(key)) ? values[String(key)] : null,
    setItem: (key, value) => {
      const next = Object.assign(Object.create(null), values, {[String(key)]:String(value)});
      if (String(key).length > 200 || Object.keys(next).length > 100 || new TextEncoder().encode(JSON.stringify(next)).length > 65536) throw new Error('应用存储已满（64 KB）');
      values = next; notify();
    },
    removeItem: key => { delete values[String(key)]; notify(); },
    clear: () => { values = Object.create(null); notify(); },
    key: index => Object.keys(values)[index] ?? null,
    get length() { return Object.keys(values).length; }
  };
  Object.defineProperty(window, 'localStorage', {value:storage});
  addEventListener('error', e => parent.postMessage({type:'agent-studio:error', message:String(e.message).slice(0,300)}, '*'));
  addEventListener('unhandledrejection', () => parent.postMessage({type:'agent-studio:error', message:'应用发生未处理的异步错误'}, '*'));
})();
</script>`;
  const safe = sanitizeGeneratedHtml(html);
  return /<head\b[^>]*>/i.test(safe)
    ? safe.replace(/<head\b[^>]*>/i, (head) => head + bootstrap)
    : bootstrap + safe;
}
