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
