// Frustration signals (server/src/lib/insights.js): labels, per-session and
// per-event lists, and shares of sessions. Pure, so it's unit-tested.
import type { OverviewTotals, SessionSummary, TrackedEvent } from './types';

export type Insight = 'rage' | 'dead' | 'quick_back' | 'excessive_scroll';

export const INSIGHTS: readonly Insight[] = ['rage', 'dead', 'quick_back', 'excessive_scroll'];

export const INSIGHT_INFO: Record<Insight, { label: string; one: string; description: string }> = {
  rage: { label: 'Rage clicks', one: 'Rage click', description: '3 or more quick clicks on one spot' },
  dead: { label: 'Dead clicks', one: 'Dead click', description: 'Clicks the page didn’t react to within 1 s' },
  quick_back: { label: 'Quick backs', one: 'Quick back', description: 'Pages left again within 7 s' },
  excessive_scroll: {
    label: 'Excessive scrolling',
    one: 'Excessive scrolling',
    description: 'Scrolled up and down 3 page heights or more',
  },
};

/** The overview total that counts sessions with each insight. */
const SESSIONS_FIELD = {
  rage: 'rage_sessions',
  dead: 'dead_sessions',
  quick_back: 'quick_back_sessions',
  excessive_scroll: 'excessive_scroll_sessions',
} as const satisfies Record<Insight, keyof OverviewTotals>;

/** The session row's count of each insight. */
const COUNT_FIELD = {
  rage: 'rage_clicks',
  dead: 'dead_clicks',
  quick_back: 'quick_backs',
  excessive_scroll: 'excessive_scrolls',
} as const satisfies Record<Insight, keyof SessionSummary>;

export const isInsight = (value: string): value is Insight => (INSIGHTS as readonly string[]).includes(value);

/** The insights a session has, with their counts, in INSIGHTS order. */
export function sessionInsights(session: Pick<SessionSummary, (typeof COUNT_FIELD)[Insight]>): { insight: Insight; count: number }[] {
  return INSIGHTS.map((insight) => ({ insight, count: session[COUNT_FIELD[insight]] ?? 0 })).filter(({ count }) => count > 0);
}

/** The insights one journey event is part of. */
export function eventInsights(event: Pick<TrackedEvent, 'rage' | 'dead' | 'quick_back' | 'excessive_scroll'>): Insight[] {
  return INSIGHTS.filter((insight) => event[insight] === true);
}

/** Sessions with the insight, and their share (0–1) of all sessions; share 0 when there are none. */
export function insightShare(totals: OverviewTotals, insight: Insight): { sessions: number; share: number } {
  const sessions = totals[SESSIONS_FIELD[insight]] ?? 0;
  return { sessions, share: totals.sessions > 0 ? sessions / totals.sessions : 0 };
}
