import { describe, expect, it } from 'vitest';
import { findInsights } from '../src/lib/insights.js';
import { clickDoc, eventDoc, HOME, PRODUCTS } from './factories.js';

const ABOUT = 'http://localhost:4000/demo/about.html';
const counts = (events) => findInsights(events).counts;

describe('rage clicks', () => {
  const burst = (at, ...overrides) =>
    overrides.map((o, i) => clickDoc({ at: at + i * 0.5, x: 100, y: 200, ...o }));

  it('finds 3 or more quick clicks on one spot, once per burst', () => {
    const events = [eventDoc({ at: 0 }), ...burst(10, {}, { x: 110 }, { y: 220 }, { x: 90 })];
    const found = findInsights(events);
    expect(found.counts.rage_clicks).toBe(1);
    expect(found.rage.size).toBe(4);
  });

  it('needs 3 clicks, each at most 700 ms after the one before', () => {
    expect(counts(burst(0, {}, {}))).toMatchObject({ rage_clicks: 0 });
    const slow = [clickDoc({ at: 0 }), clickDoc({ at: 0.7 }), clickDoc({ at: 1.401 })];
    expect(counts(slow).rage_clicks).toBe(0);
    const justInTime = [clickDoc({ at: 0 }), clickDoc({ at: 0.7 }), clickDoc({ at: 1.4 })];
    expect(counts(justInTime).rage_clicks).toBe(1);
  });

  it('measures the 30 px from the first click, so a burst cannot drift', () => {
    // Each click is 20 px from the last, but the third is 40 px from the first.
    expect(counts(burst(0, { x: 100 }, { x: 120 }, { x: 140 })).rage_clicks).toBe(0);
    expect(counts(burst(0, { x: 100 }, { x: 120 }, { x: 130 })).rage_clicks).toBe(1);
  });

  it('starts a new burst on another page or after a page view', () => {
    const otherPage = burst(0, {}, {}, { page_url: PRODUCTS });
    expect(counts(otherPage).rage_clicks).toBe(0);
    const reloaded = [...burst(0, {}, {}), eventDoc({ at: 0.9 }), clickDoc({ at: 1 })];
    expect(counts(reloaded).rage_clicks).toBe(0);
  });

  it('counts two separate bursts twice', () => {
    expect(counts([...burst(0, {}, {}, {}), ...burst(5, {}, {}, {})]).rage_clicks).toBe(2);
  });
});

describe('dead clicks', () => {
  it('counts the clicks the tracker flagged', () => {
    const events = [eventDoc({ at: 0 }), clickDoc({ at: 1, dead: true }), clickDoc({ at: 3 }), clickDoc({ at: 6, dead: true })];
    expect(counts(events).dead_clicks).toBe(2);
  });
});

describe('quick backs', () => {
  it('finds A → B → A with under 7 s on B, and marks B', () => {
    const b = eventDoc({ at: 10, page_url: ABOUT });
    const found = findInsights([eventDoc({ at: 0, page_url: HOME }), b, eventDoc({ at: 16.9, page_url: HOME })]);
    expect(found.counts.quick_backs).toBe(1);
    expect([...found.quickBacks]).toEqual([b]);
  });

  it('ignores 7 s or more on B, a reload, and going on to a third page', () => {
    const slow = [eventDoc({ at: 0 }), eventDoc({ at: 10, page_url: ABOUT }), eventDoc({ at: 17 })];
    expect(counts(slow).quick_backs).toBe(0);
    const reload = [eventDoc({ at: 0 }), eventDoc({ at: 1 }), eventDoc({ at: 2 })];
    expect(counts(reload).quick_backs).toBe(0);
    const onward = [eventDoc({ at: 0 }), eventDoc({ at: 2, page_url: ABOUT }), eventDoc({ at: 4, page_url: PRODUCTS })];
    expect(counts(onward).quick_backs).toBe(0);
  });

  it('times B by page views, so clicks on B do not matter', () => {
    const events = [
      eventDoc({ at: 0, page_url: HOME }),
      eventDoc({ at: 10, page_url: ABOUT }),
      clickDoc({ at: 12, page_url: ABOUT }),
      eventDoc({ at: 14, page_url: HOME }),
    ];
    expect(counts(events).quick_backs).toBe(1);
  });
});

describe('excessive scrolling', () => {
  // A 2400 px page in a 900 px window (factories' defaults).
  const exit = (pv_id, at, scroll_distance, overrides = {}) =>
    eventDoc({ type: 'page_exit', pv_id, at, scroll_depth: 2400, scroll_distance, active_ms: 1000, bands: [], ...overrides });

  it("judges each page view on its latest summary: 3 page heights or more", () => {
    const events = [
      eventDoc({ at: 0, pv_id: 'a' }),
      exit('a', 5, 7300), // hidden once, early
      exit('a', 9, 7100), // the latest total (a lower one can't happen, but the latest still wins)
      eventDoc({ at: 10, pv_id: 'b', page_url: PRODUCTS }),
      exit('b', 20, 7200, { page_url: PRODUCTS }), // exactly 3 × 2400
    ];
    const found = findInsights(events);
    expect(found.counts.excessive_scrolls).toBe(1);
    expect([...found.excessiveScrolls]).toEqual([events[4]]);
  });

  it('ignores pages no taller than two windows, and summaries without a page view id', () => {
    expect(counts([exit('a', 1, 9000, { doc_h: 1800 })]).excessive_scrolls).toBe(0); // 1800 = 2 × 900
    expect(counts([exit(undefined, 1, 9000)]).excessive_scrolls).toBe(0);
  });

  it("doesn't let a summary break a rage burst", () => {
    const events = [clickDoc({ at: 0 }), clickDoc({ at: 0.3 }), exit('a', 0.4, 0), clickDoc({ at: 0.6 })];
    expect(counts(events).rage_clicks).toBe(1);
  });
});

it('finds nothing in an ordinary session', () => {
  const events = [eventDoc({ at: 0 }), clickDoc({ at: 5 }), eventDoc({ at: 6, page_url: PRODUCTS }), clickDoc({ at: 30, page_url: PRODUCTS })];
  expect(counts(events)).toEqual({ rage_clicks: 0, dead_clicks: 0, quick_backs: 0, excessive_scrolls: 0 });
});
