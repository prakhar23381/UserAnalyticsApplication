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

it('finds nothing in an ordinary session', () => {
  const events = [eventDoc({ at: 0 }), clickDoc({ at: 5 }), eventDoc({ at: 6, page_url: PRODUCTS }), clickDoc({ at: 30, page_url: PRODUCTS })];
  expect(counts(events)).toEqual({ rage_clicks: 0, dead_clicks: 0, quick_backs: 0 });
});
