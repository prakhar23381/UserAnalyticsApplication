// The filter bar (the segment), kept in the URL and applied to every tab. The URL
// parameters have the API's names (server/src/lib/filters.js), so the segment
// goes to the API as it is, plus `from` worked out from the date preset.
// Pure, so it's unit-tested.
import { formatDuration, pathOf } from './format';
import type { Device } from './types';

export type RangePreset = '24h' | '7d' | '30d' | '90d' | 'all';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** The range's start is rounded down to this, so the request URL (SWR's key) stays put while polling. */
const ROUND_MS = 5 * 60 * 1000;

export const RANGES: { value: RangePreset; label: string; ms: number | null; previous: string | null }[] = [
  { value: '24h', label: 'Last 24 hours', ms: DAY, previous: 'previous 24 hours' },
  { value: '7d', label: 'Last 7 days', ms: 7 * DAY, previous: 'previous 7 days' },
  { value: '30d', label: 'Last 30 days', ms: 30 * DAY, previous: 'previous 30 days' },
  { value: '90d', label: 'Last 90 days', ms: 90 * DAY, previous: 'previous 90 days' },
  { value: 'all', label: 'All time', ms: null, previous: null },
];
export const DEFAULT_RANGE: RangePreset = '30d';

export const ALL_DEVICES: readonly Device[] = ['desktop', 'tablet', 'mobile'];

// ---- The filters beyond date and device ----

export type ListParam = 'browsers' | 'os' | 'countries' | 'referrers';
export type OneParam = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'entry_page' | 'exit_page' | 'visited_page';
export type NumberParam = 'min_duration' | 'max_duration' | 'min_pages' | 'max_pages' | 'min_clicks' | 'max_clicks';
export type FilterParam = ListParam | OneParam | NumberParam;

/** Keys of GET /api/filters, the values each menu offers. */
export type OptionsKey =
  | 'browsers'
  | 'os'
  | 'countries'
  | 'referrers'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'entry_pages'
  | 'exit_pages'
  | 'pages';

export type FilterGroup = 'Visitors' | 'Acquisition' | 'Pages' | 'Engagement';

interface BaseDef {
  id: string;
  label: string;
  group: FilterGroup;
}
/** Several values, any of which matches (a comma-separated list). */
export interface ListDef extends BaseDef {
  kind: 'list';
  param: ListParam;
  options: OptionsKey;
}
/** One exact value. */
export interface OneDef extends BaseDef {
  kind: 'one';
  param: OneParam;
  options: OptionsKey;
}
/** A whole-number range, either end optional. */
export interface RangeDef extends BaseDef {
  kind: 'range';
  min: NumberParam;
  max: NumberParam;
  unit: 'seconds' | 'count';
}
export type FilterDef = ListDef | OneDef | RangeDef;

export const FILTER_GROUPS: readonly FilterGroup[] = ['Visitors', 'Acquisition', 'Pages', 'Engagement'];

export const FILTER_DEFS: readonly FilterDef[] = [
  { id: 'browsers', label: 'Browser', group: 'Visitors', kind: 'list', param: 'browsers', options: 'browsers' },
  { id: 'os', label: 'Operating system', group: 'Visitors', kind: 'list', param: 'os', options: 'os' },
  { id: 'countries', label: 'Country', group: 'Visitors', kind: 'list', param: 'countries', options: 'countries' },
  { id: 'referrers', label: 'Referrer', group: 'Acquisition', kind: 'list', param: 'referrers', options: 'referrers' },
  { id: 'utm_source', label: 'UTM source', group: 'Acquisition', kind: 'one', param: 'utm_source', options: 'utm_source' },
  { id: 'utm_medium', label: 'UTM medium', group: 'Acquisition', kind: 'one', param: 'utm_medium', options: 'utm_medium' },
  { id: 'utm_campaign', label: 'UTM campaign', group: 'Acquisition', kind: 'one', param: 'utm_campaign', options: 'utm_campaign' },
  { id: 'entry_page', label: 'Entry page', group: 'Pages', kind: 'one', param: 'entry_page', options: 'entry_pages' },
  { id: 'exit_page', label: 'Exit page', group: 'Pages', kind: 'one', param: 'exit_page', options: 'exit_pages' },
  { id: 'visited_page', label: 'Visited page', group: 'Pages', kind: 'one', param: 'visited_page', options: 'pages' },
  { id: 'duration', label: 'Session duration', group: 'Engagement', kind: 'range', min: 'min_duration', max: 'max_duration', unit: 'seconds' },
  { id: 'pages', label: 'Pages per session', group: 'Engagement', kind: 'range', min: 'min_pages', max: 'max_pages', unit: 'count' },
  { id: 'clicks', label: 'Clicks', group: 'Engagement', kind: 'range', min: 'min_clicks', max: 'max_clicks', unit: 'count' },
];

const defParams = (def: FilterDef): FilterParam[] => (def.kind === 'range' ? [def.min, def.max] : [def.param]);

export const FILTER_PARAMS: readonly FilterParam[] = FILTER_DEFS.flatMap(defParams);

/** Every URL parameter that belongs to the segment, apart from the date range. */
export const SEGMENT_KEYS: readonly string[] = ['devices', ...FILTER_PARAMS];

export interface Filters {
  range: RangePreset;
  devices: Device[]; // never empty; in ALL_DEVICES order
  /** The other filters that are set, as clean URL values ('Chrome,Safari', 'newsletter', '30'). */
  params: Partial<Record<FilterParam, string>>;
}

const MAX_TEXT = 100;
const isNumberParam = (param: FilterParam): param is NumberParam => /^(min|max)_/.test(param);
const isListParam = (param: FilterParam): param is ListParam =>
  FILTER_DEFS.some((def) => def.kind === 'list' && def.param === param);

/** A URL value made safe to send, or null to leave the filter out. */
function cleanParam(param: FilterParam, raw: string | null): string | null {
  if (raw === null) return null;
  if (isNumberParam(param)) return /^\d{1,9}$/.test(raw.trim()) ? String(Number(raw.trim())) : null;
  if (isListParam(param)) {
    const items = [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))];
    return items.length > 0 ? items.join(',') : null;
  }
  const text = raw.trim();
  if (!text || text.length > 2048) return null;
  if (param.endsWith('_page')) return URL.canParse(text) ? text : null;
  return text.length <= MAX_TEXT ? text : null;
}

export function parseRange(value: string | null): RangePreset {
  return RANGES.find((range) => range.value === value)?.value ?? DEFAULT_RANGE;
}

/** Devices from `?devices=a,b`; missing, empty or all-unknown means every device. */
export function parseDevices(value: string | null): Device[] {
  const wanted = new Set((value ?? '').split(','));
  const devices = ALL_DEVICES.filter((device) => wanted.has(device));
  return devices.length > 0 ? devices : [...ALL_DEVICES];
}

export function readFilters(params: URLSearchParams): Filters {
  const values: Filters['params'] = {};
  for (const param of FILTER_PARAMS) {
    const value = cleanParam(param, params.get(param));
    if (value !== null) values[param] = value;
  }
  return { range: parseRange(params.get('range')), devices: parseDevices(params.get('devices')), params: values };
}

/** The `devices` URL value: null (left out) when every device is selected. */
export function devicesParam(devices: Device[]): string | null {
  return devices.length === ALL_DEVICES.length ? null : ALL_DEVICES.filter((d) => devices.includes(d)).join(',');
}

/** The `range` URL value: null (left out) for the default. */
export const rangeParam = (range: RangePreset): string | null => (range === DEFAULT_RANGE ? null : range);

/** Adds or removes one device, keeping at least one selected. */
export function toggleDevice(devices: Device[], device: Device): Device[] {
  if (devices.includes(device)) return devices.length === 1 ? devices : devices.filter((d) => d !== device);
  return ALL_DEVICES.filter((d) => d === device || devices.includes(d));
}

/** The values chosen for a list filter. */
export const listValues = (filters: Filters, param: ListParam): string[] => filters.params[param]?.split(',') ?? [];

/** A list filter's URL value with one value added or removed; null when none is left. */
export function toggleListValue(filters: Filters, param: ListParam, value: string): string | null {
  const current = listValues(filters, param);
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  return next.length > 0 ? next.join(',') : null;
}

/** True when the filter has a value (either end, for a range). */
export const isFilterSet = (def: FilterDef, filters: Filters): boolean =>
  defParams(def).some((param) => filters.params[param] !== undefined);

/** The filters (beyond date and device) that are set, in menu order. */
export const activeFilters = (filters: Filters): FilterDef[] => FILTER_DEFS.filter((def) => isFilterSet(def, filters));

/** True when the segment is narrower than "everything" (any date range but all time, fewer devices, any filter). */
export const isNarrowed = (filters: Filters): boolean =>
  filters.range !== 'all' || filters.devices.length < ALL_DEVICES.length || Object.keys(filters.params).length > 0;

/** URL changes that remove one filter. */
export const clearFilter = (def: FilterDef): Record<string, null> =>
  Object.fromEntries(defParams(def).map((param) => [param, null]));

/** URL changes that remove every filter but the date range. */
export const clearAllFilters = (): Record<string, null> => Object.fromEntries(SEGMENT_KEYS.map((key) => [key, null]));

// ---- Labels ----

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** "IN" → "India"; unknown codes stay as they are. */
export function countryName(code: string): string {
  if (code === 'unknown') return 'Unknown';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** How a filter value reads in menus and chips. */
export function optionLabel(options: OptionsKey, value: string): string {
  if (options === 'countries') return countryName(value);
  if (options === 'referrers' && value === 'direct') return 'Direct (no referrer)';
  if (options === 'entry_pages' || options === 'exit_pages' || options === 'pages') return pathOf(value);
  return value;
}

const formatBound = (def: RangeDef, value: string) =>
  def.unit === 'seconds' ? formatDuration(Number(value) * 1000) : Number(value).toLocaleString('en');

/** What a chip says after the filter's name: "Chrome, Safari", "/demo/about.html", "10s – 2m 00s", "≥ 3". */
export function filterSummary(def: FilterDef, filters: Filters): string {
  if (def.kind === 'list') return listValues(filters, def.param).map((value) => optionLabel(def.options, value)).join(', ');
  if (def.kind === 'one') return optionLabel(def.options, filters.params[def.param] ?? '');
  const min = filters.params[def.min];
  const max = filters.params[def.max];
  if (min !== undefined && max !== undefined) return `${formatBound(def, min)} – ${formatBound(def, max)}`;
  if (min !== undefined) return `≥ ${formatBound(def, min)}`;
  return `≤ ${formatBound(def, max ?? '0')}`;
}

// ---- To the API ----

/** Query parameters for the API: `from`, `devices` and the other filters, all as strings. */
export type ApiFilterParams = Record<string, string>;

/**
 * The filters as API query parameters. `to` is left out: the API uses the time
 * of the request, so polling keeps the window current. `from` is rounded down
 * to 5 minutes so the URL changes at most that often.
 */
export function apiFilterParams(filters: Filters, now: number): ApiFilterParams {
  const params: ApiFilterParams = {};
  const ms = RANGES.find((range) => range.value === filters.range)?.ms;
  if (ms) params.from = new Date(Math.floor((now - ms) / ROUND_MS) * ROUND_MS).toISOString();
  const devices = devicesParam(filters.devices);
  if (devices) params.devices = devices;
  for (const param of FILTER_PARAMS) {
    const value = filters.params[param];
    if (value !== undefined) params[param] = value;
  }
  return params;
}

/** A query string fragment (`&from=…&devices=…`, or '') for appending to an API URL. */
export function apiFilterQuery(params: ApiFilterParams, keys?: readonly string[]): string {
  const query = new URLSearchParams();
  for (const key of keys ?? Object.keys(params)) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `&${text}` : '';
}
