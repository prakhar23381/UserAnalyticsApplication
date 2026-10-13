import type { TrackedEvent } from './types';

export interface PageVisit {
  page_url: string;
  events: TrackedEvent[];
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
  for (const event of events) {
    const current = visits.at(-1);
    if (!current || event.type === 'page_view' || event.page_url !== current.page_url) {
      visits.push({ page_url: event.page_url, events: [event] });
    } else {
      current.events.push(event);
    }
  }
  return visits;
}
