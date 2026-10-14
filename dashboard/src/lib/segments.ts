// Saved segments, the default segment and the watchlist (M2c in docs/v2-plan.md).
// They live in the viewer's browser (D3: no accounts), so everything read back
// from storage is checked here first. A saved segment is its filters without
// the date range (M2-D4): the watchlist shows every segment over the same dates.
import { clearAllFilters, devicesParam, FILTER_PARAMS, type Filters, readFilters } from './filters';
import type { Changes } from './url';

export interface SavedSegment {
  id: string;
  name: string;
  /** The segment's URL parameters in a fixed order ('devices=mobile&browsers=Safari'). */
  query: string;
}

export type WatchItem = { kind: 'segment'; id: string } | { kind: 'page'; page_url: string };

export const STORAGE_KEYS = {
  segments: 'trailmark.segments',
  defaultSegment: 'trailmark.default_segment',
  watchlist: 'trailmark.watchlist',
} as const;

export const MAX_NAME = 40;
const MAX_SEGMENTS = 50;
const MAX_WATCHED = 20;

/** The current filters as a saved segment's query: no date range, parameters in a fixed order. */
export function segmentQuery(filters: Filters): string {
  const query = new URLSearchParams();
  const devices = devicesParam(filters.devices);
  if (devices) query.set('devices', devices);
  for (const param of FILTER_PARAMS) {
    const value = filters.params[param];
    if (value !== undefined) query.set(param, value);
  }
  return query.toString();
}

/** A query read back through the URL rules, so stored junk can't reach the API. */
const cleanQuery = (query: string): string => segmentQuery(readFilters(new URLSearchParams(query)));

/** URL changes that replace the current filters (not the date range) with a segment's. */
export function applySegment(query: string): Changes {
  return { ...clearAllFilters(), ...Object.fromEntries(new URLSearchParams(cleanQuery(query))), p: null };
}

/** The saved segment the current filters are exactly, if any. */
export function matchSegment(segments: SavedSegment[], filters: Filters): SavedSegment | undefined {
  const query = segmentQuery(filters);
  return segments.find((segment) => segment.query === query);
}

/** Why a new segment can't be saved under this name with these filters, or null when it can. */
export function saveProblem(segments: SavedSegment[], name: string, query: string): string | null {
  const trimmed = name.trim();
  if (!query) return 'Add a filter first: "All visitors" is already there.';
  if (!trimmed) return 'Give the segment a name.';
  if (trimmed.length > MAX_NAME) return `Keep the name under ${MAX_NAME + 1} characters.`;
  if (segments.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return `There's already a segment called "${trimmed}".`;
  const same = segments.find((s) => s.query === query);
  if (same) return `These filters are already saved as "${same.name}".`;
  if (segments.length >= MAX_SEGMENTS) return `You can keep up to ${MAX_SEGMENTS} segments.`;
  return null;
}

export const addSegment = (segments: SavedSegment[], segment: SavedSegment): SavedSegment[] => [
  ...segments,
  { ...segment, name: segment.name.trim() },
];

export const renameSegment = (segments: SavedSegment[], id: string, name: string): SavedSegment[] =>
  segments.map((segment) => (segment.id === id ? { ...segment, name: name.trim() } : segment));

export const removeSegment = (segments: SavedSegment[], id: string): SavedSegment[] => segments.filter((s) => s.id !== id);

/** Why a segment can't be renamed to this, or null. */
export function renameProblem(segments: SavedSegment[], id: string, name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Give the segment a name.';
  if (trimmed.length > MAX_NAME) return `Keep the name under ${MAX_NAME + 1} characters.`;
  if (segments.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
    return `There's already a segment called "${trimmed}".`;
  }
  return null;
}

// ---- Watchlist ----

const sameItem = (a: WatchItem, b: WatchItem) =>
  a.kind === b.kind && (a.kind === 'segment' ? a.id === (b as typeof a).id : a.page_url === (b as typeof a).page_url);

export const isWatched = (items: WatchItem[], item: WatchItem): boolean => items.some((other) => sameItem(other, item));

/** Adds or removes one item (new items go last); the list is capped. */
export function toggleWatch(items: WatchItem[], item: WatchItem): WatchItem[] {
  if (isWatched(items, item)) return items.filter((other) => !sameItem(other, item));
  return items.length >= MAX_WATCHED ? items : [...items, item];
}

/** Drops watched segments that no longer exist. */
export const liveWatchItems = (items: WatchItem[], segments: SavedSegment[]): WatchItem[] =>
  items.filter((item) => item.kind === 'page' || segments.some((segment) => segment.id === item.id));

// ---- Reading storage (anything may be in there) ----

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function parseSegments(raw: string | null): SavedSegment[] {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  const segments: SavedSegment[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.query !== 'string') continue;
    const name = item.name.trim().slice(0, MAX_NAME);
    const query = cleanQuery(item.query);
    if (!item.id || !name || !query || segments.some((s) => s.id === item.id)) continue;
    segments.push({ id: item.id, name, query });
  }
  return segments.slice(0, MAX_SEGMENTS);
}

export function parseDefaultSegment(raw: string | null): string | null {
  const value = parseJson(raw);
  return typeof value === 'string' && value ? value : null;
}

export function parseWatchlist(raw: string | null): WatchItem[] {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return [];
  const items: WatchItem[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    let parsed: WatchItem | null = null;
    if (item.kind === 'segment' && typeof item.id === 'string' && item.id) parsed = { kind: 'segment', id: item.id };
    if (item.kind === 'page' && typeof item.page_url === 'string' && URL.canParse(item.page_url)) {
      parsed = { kind: 'page', page_url: item.page_url };
    }
    if (parsed && !isWatched(items, parsed)) items.push(parsed);
  }
  return items.slice(0, MAX_WATCHED);
}
