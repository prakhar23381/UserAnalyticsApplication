'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type ApiFilterParams, apiFilterParams, type Filters, parseDevices, parseRange } from './filters';
import { type Changes, dashboardHref } from './url';

/** Builds links that keep the rest of the current view (filters, other tabs' state). */
export function useDashboardHref(): (changes: Changes) => string {
  const params = useSearchParams();
  return useCallback((changes: Changes) => dashboardHref(params.toString(), changes), [params]);
}

/** The current time, refreshed every `intervalMs` (for "last N days" windows). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** The filter bar's state, from the URL. */
export function useFilters(): Filters {
  const params = useSearchParams();
  const range = params.get('range');
  const devices = params.get('devices');
  return useMemo(() => ({ range: parseRange(range), devices: parseDevices(devices) }), [range, devices]);
}

/** The filter bar's state as API query parameters (stable for 5 minutes at a time). */
export function useApiFilters(): ApiFilterParams {
  const filters = useFilters();
  const now = useNow();
  return useMemo(() => apiFilterParams(filters, now), [filters, now]);
}
