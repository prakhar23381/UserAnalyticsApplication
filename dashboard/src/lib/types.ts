// Response shapes of the API (server/src/routes). Field names are snake_case, as stored.
import type { OptionsKey } from './filters';

export type EventType = 'page_view' | 'click';
export type Device = 'mobile' | 'tablet' | 'desktop';

export interface ClickTarget {
  tag?: string;
  id?: string;
  classes?: string;
  text?: string;
}

export interface TrackedEvent {
  _id: string;
  session_id: string;
  type: EventType;
  page_url: string; // normalized: origin + pathname
  raw_url: string; // exactly what the browser had
  timestamp: string; // client clock
  received_at: string; // server clock
  x?: number; // clicks only: document coordinates in CSS px
  y?: number;
  target?: ClickTarget;
  dead?: true; // clicks only: the page didn't react within 1 s (tracker)
  rage?: true; // journey only: part of a rage-click burst
  quick_back?: true; // journey only: a page view left again within 7 s
  viewport_w: number;
  viewport_h: number;
  doc_w: number;
  doc_h: number;
  device: Device;
  referrer?: string;
  user_agent?: string;
  country?: string;
}

/** GET /api/sessions/:id/events */
export interface SessionEvents {
  session_id: string;
  session: SessionSummary | null; // null until the server has built it
  events: TrackedEvent[];
}

/** One row of GET /api/sessions */
export interface SessionSummary {
  session_id: string;
  event_count: number;
  page_views: number;
  clicks: number;
  rage_clicks: number; // bursts (lib/insights.ts)
  dead_clicks: number;
  quick_backs: number;
  first_seen: string;
  last_seen: string;
  duration_ms: number;
  entry_page: string;
  exit_page: string;
  pages_visited: number;
  device: Device;
  browser: string;
  os: string;
  country: string | null; // two letters; null when the host didn't say
  referrer: string | null; // the referring site's host, only when it's another site
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  source: string; // utm_source, else referrer, else "Direct"
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

/** One row of GET /api/pages */
export interface PageSummary {
  page_url: string;
  page_views: number;
  clicks: number;
  last_seen: string;
}

export interface PagesResponse {
  data: PageSummary[];
}

export interface HeatmapClick {
  x: number;
  y: number;
  doc_w: number;
  doc_h: number;
  viewport_w: number;
  viewport_h: number;
  device: Device;
}

/** GET /api/heatmap */
export interface HeatmapResponse {
  page_url: string;
  device: Device | 'all';
  total_clicks: number; // uncapped; clicks holds the newest 5000 at most
  clicks: HeatmapClick[];
}

export interface OverviewTotals {
  sessions: number;
  page_views: number;
  clicks: number;
  avg_duration_ms: number;
  pages_per_session: number;
  bounce_rate: number; // 0–1: share of sessions with at most one page view
  rage_sessions: number; // sessions with at least one rage click
  dead_sessions: number;
  quick_back_sessions: number;
}

/** GET /api/overview */
export interface OverviewResponse {
  range: { from: string | null; to: string };
  totals: OverviewTotals;
  previous: OverviewTotals | null; // the period of equal length just before; null for all time
  series: { date: string; sessions: number }[]; // UTC days, gaps filled with 0
  top_pages: { page_url: string; page_views: number }[];
  devices: { device: Device; sessions: number }[];
  browsers: ValueCount[];
  countries: { value: string | null; sessions: number }[]; // null: no country recorded
  sources: ValueCount[];
}

export interface ValueCount {
  value: string;
  sessions: number;
}

/** GET /api/filters: the values each filter menu offers, most common first */
export type FilterOptionsResponse = Record<OptionsKey, ValueCount[]>;

/** Body of every 4xx/5xx response */
export interface ApiErrorBody {
  error: string;
}
