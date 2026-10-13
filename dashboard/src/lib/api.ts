import useSWR, { type SWRConfiguration } from 'swr';
import type { ApiErrorBody, Device } from './types';

const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
if (!configuredUrl) {
  throw new Error('Missing NEXT_PUBLIC_API_URL (see dashboard/.env.local.example)');
}

/** Base URL of the API. Inlined at build time, so changing it needs a rebuild. */
export const API_URL = configuredUrl.replace(/\/+$/, '');

export const DEMO_URL = `${API_URL}/demo/`;

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

export const sessionsUrl = (page: number) => `${API_URL}/api/sessions?page=${page}`;

export const sessionEventsUrl = (id: string) =>
  `${API_URL}/api/sessions/${encodeURIComponent(id)}/events`;

export const pagesUrl = () => `${API_URL}/api/pages`;

export const heatmapUrl = (page: string, device: Device) =>
  `${API_URL}/api/heatmap?${new URLSearchParams({ page, device })}`;
