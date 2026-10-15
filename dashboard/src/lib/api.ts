import useSWR, { type SWRConfiguration } from 'swr';
import { API_URL } from './config';
import { type ApiFilterParams, apiFilterQuery } from './filters';
import type { ApiErrorBody, Device } from './types';

export { API_URL, DEMO_URL } from './config';

/** How often every view re-fetches, so new events show up without a reload. */
export const POLL_MS = 5000;

/** A non-2xx response. `status` lets a view tell "not found" from "broken". */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as ApiErrorBody | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

/** GET an API URL and keep it fresh. A null url fetches nothing. */
export function useApi<T>(url: string | null, options?: SWRConfiguration<T, Error>) {
  return useSWR<T, Error>(url, fetcher<T>, { refreshInterval: POLL_MS, ...options });
}

// The filter bar's parameters ride along on every read (lib/filters.ts).
export const sessionsUrl = (page: number, filters: ApiFilterParams = {}) =>
  `${API_URL}/api/sessions?page=${page}${apiFilterQuery(filters)}`;

export const sessionEventsUrl = (id: string) =>
  `${API_URL}/api/sessions/${encodeURIComponent(id)}/events`;

export const pagesUrl = (filters: ApiFilterParams = {}) =>
  `${API_URL}/api/pages${apiFilterQuery(filters).replace(/^&/, '?')}`;

// The segment picks the sessions; `device` picks the layout to draw.
export const heatmapUrl = (page: string, device: Device, filters: ApiFilterParams = {}) =>
  `${API_URL}/api/heatmap?${new URLSearchParams({ page, device })}${apiFilterQuery(filters)}`;

// The page's elements ranked by clicks, for the same page, device and segment as the heatmap.
export const elementsUrl = (page: string, device: Device, filters: ApiFilterParams = {}) =>
  `${API_URL}/api/elements?${new URLSearchParams({ page, device })}${apiFilterQuery(filters)}`;

// Page-view summaries for the scroll and attention maps, like the heatmap's request.
export const engagementUrl = (page: string, device: Device, filters: ApiFilterParams = {}) =>
  `${API_URL}/api/engagement?${new URLSearchParams({ page, device })}${apiFilterQuery(filters)}`;

export const overviewUrl = (filters: ApiFilterParams = {}) =>
  `${API_URL}/api/overview${apiFilterQuery(filters).replace(/^&/, '?')}`;

// The filter menus' values depend on the date range only.
export const filterOptionsUrl = (filters: ApiFilterParams = {}) =>
  `${API_URL}/api/filters${apiFilterQuery(filters, ['from']).replace(/^&/, '?')}`;
