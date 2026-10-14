import { describe, expect, it } from 'vitest';
import { eventInsights, insightShare, isInsight, sessionInsights } from './insights';
import type { OverviewTotals } from './types';

const totals: OverviewTotals = {
  sessions: 40,
  page_views: 90,
  clicks: 120,
  avg_duration_ms: 20_000,
  pages_per_session: 2.25,
  bounce_rate: 0.4,
  rage_sessions: 4,
  dead_sessions: 10,
  quick_back_sessions: 0,
};

describe('sessionInsights', () => {
  it('lists only the insights a session has, in a fixed order', () => {
    expect(sessionInsights({ rage_clicks: 0, dead_clicks: 3, quick_backs: 1 })).toEqual([
      { insight: 'dead', count: 3 },
      { insight: 'quick_back', count: 1 },
    ]);
    expect(sessionInsights({ rage_clicks: 0, dead_clicks: 0, quick_backs: 0 })).toEqual([]);
  });
});

describe('eventInsights', () => {
  it('reads the flags the API sets on journey events', () => {
    expect(eventInsights({ rage: true, dead: true })).toEqual(['rage', 'dead']);
    expect(eventInsights({ quick_back: true })).toEqual(['quick_back']);
    expect(eventInsights({})).toEqual([]);
  });
});

describe('insightShare', () => {
  it('is the share of sessions with the insight', () => {
    expect(insightShare(totals, 'rage')).toEqual({ sessions: 4, share: 0.1 });
    expect(insightShare(totals, 'dead')).toEqual({ sessions: 10, share: 0.25 });
    expect(insightShare(totals, 'quick_back')).toEqual({ sessions: 0, share: 0 });
  });

  it('is 0, not NaN, without sessions', () => {
    expect(insightShare({ ...totals, sessions: 0, rage_sessions: 0 }, 'rage')).toEqual({ sessions: 0, share: 0 });
  });
});

it('recognizes insight names', () => {
  expect(['rage', 'dead', 'quick_back', 'bored'].map(isInsight)).toEqual([true, true, true, false]);
});
