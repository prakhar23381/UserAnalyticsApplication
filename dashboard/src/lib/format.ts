import type { ClickTarget } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Session ids are UUIDs, `seed_` + 12 characters, or the tracker's time-based
 * fallback. Their first 13 characters are enough to tell them apart.
 */
export function shortId(id: string, length = 13): string {
  return id.length > length ? `${id.slice(0, length)}…` : id;
}

/** 45_000 → "45s", 185_000 → "3m 05s", 3_720_000 → "1h 02m" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/** Time since the session started, read like a stopwatch: "+01:23", "+1:02:03". */
export function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `+${h}:${pad(m)}:${pad(s)}` : `+${pad(m)}:${pad(s)}`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** "just now", "5 minutes ago", "yesterday". Timestamps come from visitors' clocks, so a future one is "just now". */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - Date.parse(iso)) / 1000);
  if (seconds < 10) return 'just now';
  const [unit, size] = UNITS.find(([, unitSeconds]) => seconds >= unitSeconds) ?? UNITS[UNITS.length - 1];
  return relative.format(-Math.floor(seconds / size), unit);
}

/** Local date and time, for tooltips and headers. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

/** "http://localhost:4000/demo/products.html" → "/demo/products.html" */
export function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** What was clicked, as the journey shows it: `button#add-espresso "Add to cart"`. */
export function describeTarget(target?: ClickTarget): string {
  if (!target) return 'unknown element';
  let label = target.tag ?? 'element';
  if (target.id) label += `#${target.id}`;
  else if (target.classes) label += `.${target.classes.split(' ')[0]}`;
  return target.text ? `${label} "${truncate(target.text, 40)}"` : label;
}
