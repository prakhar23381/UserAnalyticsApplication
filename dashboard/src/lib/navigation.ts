'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { type Changes, dashboardHref } from './url';

/** Builds links that keep the rest of the current view (filters, other tabs' state). */
export function useDashboardHref(): (changes: Changes) => string {
  const params = useSearchParams();
  return useCallback((changes: Changes) => dashboardHref(params.toString(), changes), [params]);
}
