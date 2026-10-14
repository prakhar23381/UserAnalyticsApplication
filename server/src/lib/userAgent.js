// Browser and operating system from a User-Agent header, for the segment filters
// (D6 in docs/v2-plan.md). A short list of the browsers and systems that matter,
// checked in an order that handles the ones pretending to be others: Edge,
// Opera and Samsung Internet all say "Chrome", and Chrome says "Safari".
// Brave and other Chromium browsers that don't name themselves count as Chrome.

const BROWSERS = [
  ['Edge', /\bEdg(?:e|A|iOS)?\//],
  ['Opera', /\bOPR\/|\bOPT\/|\bOpera\b/],
  ['Samsung Internet', /\bSamsungBrowser\//],
  ['Firefox', /\bFirefox\/|\bFxiOS\//],
  ['Chrome', /\bChrome\/|\bCriOS\/|\bHeadlessChrome\//],
  ['Safari', /\bVersion\/[\d.]+.*\bSafari\//],
];

const SYSTEMS = [
  ['iOS', /\b(?:iPhone|iPad|iPod)\b/],
  ['Android', /\bAndroid\b/],
  ['ChromeOS', /\bCrOS\b/],
  ['Windows', /\bWindows\b/],
  // iPads in desktop mode send a Mac user agent, so they count as macOS.
  ['macOS', /\bMac OS X\b|\bMacintosh\b/],
  ['Linux', /\bLinux\b/],
];

const match = (list, ua) => list.find(([, re]) => re.test(ua))?.[0] ?? 'Other';

/** `{ browser, os }` from a user agent; each is 'Other' when unknown, both when it's missing. */
export function parseUserAgent(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent) return { browser: 'Other', os: 'Other' };
  return { browser: match(BROWSERS, userAgent), os: match(SYSTEMS, userAgent) };
}

export const BROWSER_NAMES = [...BROWSERS.map(([name]) => name), 'Other'];
export const OS_NAMES = [...SYSTEMS.map(([name]) => name), 'Other'];
