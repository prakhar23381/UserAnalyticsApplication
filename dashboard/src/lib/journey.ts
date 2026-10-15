import type { TrackedEvent } from './types';

export interface PageVisit {
  page_url: string;
  events: TrackedEvent[]; // page views and clicks
  exit?: TrackedEvent; // the latest page_exit for this visit: its running totals
}

/**
 * Splits a journey (events oldest first) into page visits. Each page_view
 * starts one. So does an event on a different page than the current visit,
 * so that clicks whose page_view was lost don't land under the wrong page.
 */
const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const queryOf = (url: string) => {
  try {
    return new URL(url).search;
  } catch {
    return '';
  }
};

/** Where a session came from: its first event's `utm_source`, else the referring site, else "Direct". */
export function sourceOf(event: TrackedEvent): string {
  try {
    const utm = new URL(event.raw_url).searchParams.get('utm_source');
    if (utm) return utm;
  } catch {
    // raw_url is validated on ingest; fall through to the referrer
  }
  return (event.referrer && hostOf(event.referrer)) || 'Direct';
}

/**
 * What a page view adds to its path: the query string the visitor arrived
 * with, and the referring site when it isn't this one.
 * "?utm_source=newsletter · from www.google.com"
 */
export function pageViewNote(event: TrackedEvent): string {
  const notes: string[] = [];
  const query = queryOf(event.raw_url);
  if (query) notes.push(query);
  const referrer = event.referrer && hostOf(event.referrer);
  if (referrer && referrer !== hostOf(event.page_url)) notes.push(`from ${referrer}`);
  return notes.join(' · ');
}

export function groupByPageVisit(events: TrackedEvent[]): PageVisit[] {
  const visits: PageVisit[] = [];
  const byPageView = new Map<string, PageVisit>();
  for (const event of events) {
    const current = visits.at(-1);
    if (event.type === 'page_exit') {
      // Its page view's visit (by pv_id), else the current visit on the same page. Later totals win.
      const visit = (event.pv_id && byPageView.get(event.pv_id)) || (current?.page_url === event.page_url ? current : undefined);
      if (visit) visit.exit = event;
      continue;
    }
    if (!current || event.type === 'page_view' || event.page_url !== current.page_url) {
      const visit: PageVisit = { page_url: event.page_url, events: [event] };
      visits.push(visit);
      if (event.type === 'page_view' && event.pv_id) byPageView.set(event.pv_id, visit);
    } else {
      current.events.push(event);
    }
  }
  return visits;
}

/** "Active 12s · scrolled 76%" for a visit with an exit summary, else null. */
export function visitEngagement(visit: PageVisit, formatMs: (ms: number) => string): string | null {
  const exit = visit.exit;
  if (!exit || exit.active_ms === undefined || exit.scroll_depth === undefined) return null;
  const scrolled = exit.doc_h > 0 ? Math.min(1, exit.scroll_depth / exit.doc_h) : 1;
  return `Active ${formatMs(exit.active_ms)} · scrolled ${Math.round(scrolled * 100)}%`;
}
