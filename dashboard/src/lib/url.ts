// The dashboard is one page; everything it shows is in the query string, so
// any view can be shared and the back button works:
//
//   ?tab=overview|sessions|heatmaps
//   sessions:  p=<list page>, session=<id> (a journey, opened inside the tab)
//   heatmaps:  page=<page URL>, device=desktop|tablet|mobile, mode=dots|grid
//   lab only:  theme=light|dark

export type Tab = 'overview' | 'sessions' | 'heatmaps';

export const TABS: readonly Tab[] = ['overview', 'sessions', 'heatmaps'];
export const DEFAULT_TAB: Tab = 'overview';

export function parseTab(value: string | null): Tab {
  return TABS.find((tab) => tab === value) ?? DEFAULT_TAB;
}

/** A 1-based page number from the URL; anything else is page 1. */
export function parsePageNumber(value: string | null): number {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isNaN(page) || page < 1 ? 1 : page;
}

export type Changes = Record<string, string | number | null | undefined>;

/**
 * The dashboard URL for the current query with some parameters changed; null
 * or undefined removes one. Changing tab closes an open journey, and the
 * default tab isn't written out.
 */
export function dashboardHref(current: URLSearchParams | string, changes: Changes): string {
  const params = new URLSearchParams(current);
  if ('tab' in changes && changes.tab !== params.get('tab')) params.delete('session');
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  if (params.get('tab') === DEFAULT_TAB) params.delete('tab');
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

/** Where the routes of the two-page dashboard (before v2) live now. */
export function legacyHref(pathname: string, params: URLSearchParams): string {
  const session = /^\/sessions\/([^/]+)$/.exec(pathname);
  if (session) return dashboardHref('', { tab: 'sessions', session: decodeURIComponent(session[1]) });
  if (pathname === '/sessions') {
    const page = parsePageNumber(params.get('page'));
    return dashboardHref('', { tab: 'sessions', p: page > 1 ? page : null });
  }
  if (pathname === '/heatmap') {
    return dashboardHref('', {
      tab: 'heatmaps',
      page: params.get('page'),
      device: params.get('device'),
      mode: params.get('mode'),
    });
  }
  return '/';
}
