import { describe, expect, it } from 'vitest';
import { groupByPageVisit, pageViewNote, sourceOf, visitEngagement } from './journey';
import type { EventType, TrackedEvent } from './types';

const HOME = 'http://localhost:4000/demo';
const PRODUCTS = 'http://localhost:4000/demo/products.html';

let seq = 0;
const event = (type: EventType, page_url: string): TrackedEvent => {
  seq += 1;
  return {
    _id: `e${seq}`,
    session_id: 's_1',
    type,
    page_url,
    raw_url: page_url,
    timestamp: new Date(Date.UTC(2026, 9, 13, 12, 0, seq)).toISOString(),
    received_at: new Date(Date.UTC(2026, 9, 13, 12, 0, seq)).toISOString(),
    viewport_w: 1280,
    viewport_h: 800,
    doc_w: 1280,
    doc_h: 920,
    device: 'desktop',
  };
};

const shape = (events: TrackedEvent[]) =>
  groupByPageVisit(events).map((visit) => [visit.page_url, visit.events.map((e) => e._id)]);

describe('groupByPageVisit', () => {
  it('starts a visit at each page_view and keeps clicks with it', () => {
    const events = [
      event('page_view', HOME),
      event('click', HOME),
      event('page_view', PRODUCTS),
      event('click', PRODUCTS),
      event('click', PRODUCTS),
    ];
    expect(shape(events)).toEqual([
      [HOME, [events[0]._id, events[1]._id]],
      [PRODUCTS, [events[2]._id, events[3]._id, events[4]._id]],
    ]);
  });

  it('makes a reload of the same page its own visit', () => {
    const events = [event('page_view', HOME), event('page_view', HOME)];
    expect(groupByPageVisit(events)).toHaveLength(2);
  });

  it('starts a visit when a click is on another page (its page_view was lost)', () => {
    const events = [event('click', HOME), event('page_view', HOME), event('click', PRODUCTS)];
    expect(shape(events)).toEqual([
      [HOME, [events[0]._id]],
      [HOME, [events[1]._id]],
      [PRODUCTS, [events[2]._id]],
    ]);
  });

  it('returns no visits for no events', () => {
    expect(groupByPageVisit([])).toEqual([]);
  });
});

describe('sourceOf', () => {
  it('prefers utm_source from the landing URL', () => {
    const landing = { ...event('page_view', HOME), raw_url: `${HOME}/?utm_source=newsletter`, referrer: 'https://www.google.com/' };
    expect(sourceOf(landing)).toBe('newsletter');
  });

  it('falls back to the referring host, then to Direct', () => {
    expect(sourceOf({ ...event('page_view', HOME), referrer: 'https://www.google.com/search?q=coffee' })).toBe('www.google.com');
    expect(sourceOf(event('page_view', HOME))).toBe('Direct');
    expect(sourceOf({ ...event('page_view', HOME), referrer: 'not a url' })).toBe('Direct');
  });
});

describe('pageViewNote', () => {
  it('shows the query string and an outside referrer', () => {
    const view = { ...event('page_view', HOME), raw_url: `${HOME}?utm_source=instagram`, referrer: 'https://l.instagram.com/' };
    expect(pageViewNote(view)).toBe('?utm_source=instagram · from l.instagram.com');
  });

  it('leaves out a referrer on the same site', () => {
    expect(pageViewNote({ ...event('page_view', PRODUCTS), referrer: `${HOME}/` })).toBe('');
  });
});

describe('page exits', () => {
  const view = (pv_id: string, page_url = HOME) => ({ ...event('page_view', page_url), pv_id });
  const exit = (pv_id: string | undefined, page_url: string, active_ms: number, scroll_depth = 900) => ({
    ...event('page_exit', page_url),
    ...(pv_id && { pv_id }),
    active_ms,
    scroll_depth,
  });

  it('attaches the latest exit to its page view, by pv_id, without making it a row', () => {
    const events = [view('a'), exit('a', HOME, 1000), view('b', PRODUCTS), exit('a', HOME, 4000), exit('b', PRODUCTS, 2000)];
    const visits = groupByPageVisit(events);
    expect(visits.map((v) => [v.events.length, v.exit?.active_ms])).toEqual([
      [1, 4000],
      [1, 2000],
    ]);
  });

  it('falls back to the current visit on the same page without a pv_id, and drops orphans', () => {
    const visits = groupByPageVisit([event('page_view', HOME), exit(undefined, HOME, 3000), exit(undefined, PRODUCTS, 9000)]);
    expect(visits.map((v) => v.exit?.active_ms)).toEqual([3000]);
  });

  it('describes active time and how far down the page the visitor got', () => {
    const [visit] = groupByPageVisit([view('a'), { ...exit('a', HOME, 12_000, 1500), doc_h: 2000 }]);
    expect(visitEngagement(visit, (ms) => `${ms / 1000}s`)).toBe('Active 12s · scrolled 75%');
    expect(visitEngagement(groupByPageVisit([view('b')])[0], String)).toBeNull();
  });
});
