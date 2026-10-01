/** True when the URL has a `debug` parameter, which also loads the eruda console. */
export function isDebugMode(): boolean {
  return new URLSearchParams(location.search).has('debug');
}
