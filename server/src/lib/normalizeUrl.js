/**
 * The identity of a page: origin + pathname, without query, hash, trailing
 * slash or index.html. `/demo`, `/demo/` and `/demo/index.html?utm_source=x`
 * are all the same page, so their clicks land on the same heatmap.
 *
 * Throws on anything `new URL()` can't parse.
 */
export function normalizeUrl(raw) {
  const url = new URL(raw);
  const path = url.pathname.replace(/\/index\.html?$/i, '/').replace(/\/+$/, '');
  return `${url.protocol}//${url.host}${path || '/'}`;
}
