// The filter bar: a date range preset and the devices, kept in the URL
// (?range=, ?devices=) and applied to every tab. Pure, so it's unit-tested.
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

export interface Filters {
  range: RangePreset;
  devices: Device[]; // never empty; in ALL_DEVICES order
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
  return { range: parseRange(params.get('range')), devices: parseDevices(params.get('devices')) };
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

export interface ApiFilterParams {
  from?: string;
  devices?: string;
}

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
  return params;
}

/** A query string fragment (`&from=…&devices=…`, or '') for appending to an API URL. */
export function apiFilterQuery(params: ApiFilterParams, keys: (keyof ApiFilterParams)[] = ['from', 'devices']): string {
  const query = new URLSearchParams();
  for (const key of keys) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  const text = query.toString();
  return text ? `&${text}` : '';
}
