/** GitHub Pages serves this app from a sub-path, so every route/redirect needs it prefixed. */
const BASE_URL: string = import.meta.env.BASE_URL;

/** Prefixes an app-root-relative path (e.g. `'room/ABC'`, `'/'`) with the deployed base path. */
export function withBase(path: string): string {
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const rest = path.startsWith('/') ? path.slice(1) : path;
  return rest ? `${base}/${rest}` : `${base}/`;
}
