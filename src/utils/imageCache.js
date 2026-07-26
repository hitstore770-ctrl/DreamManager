// Remote cover images are cached by the platform image loader, which has no
// public "clear" API in bare React Native. Appending a version token to the
// URI is the portable way to force a re-fetch: bumping the token in Settings
// makes every remote image miss its cache entry once.

export function bustCache(uri, token) {
  if (!uri || !token) return uri;
  if (!/^https?:/i.test(uri)) return uri; // local/bundled assets are unaffected
  return `${uri}${uri.includes("?") ? "&" : "?"}_v=${token}`;
}
