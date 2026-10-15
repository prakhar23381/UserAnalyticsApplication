import express from 'express';
import { parseFilters, sessionMatch } from '../lib/filters.js';
import { findInsights } from '../lib/insights.js';
import { SESSION_ID_RE } from '../lib/validateEvent.js';
import { Event } from '../models/Event.js';
import { Session } from '../models/Session.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const router = express.Router();

// A missing or non-numeric value falls back; an out-of-range one is clamped.
// A repeated param (?page=1&page=2) arrives as an array and gives null.
function intParam(value, { fallback, min, max }) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// What every session row carries; fields a session doesn't have come back as null.
export const SESSION_FIELDS = {
  _id: 0,
  session_id: 1,
  event_count: 1,
  page_views: 1,
  clicks: 1,
  rage_clicks: { $ifNull: ['$rage_clicks', 0] },
  dead_clicks: { $ifNull: ['$dead_clicks', 0] },
  quick_backs: { $ifNull: ['$quick_backs', 0] },
  excessive_scrolls: { $ifNull: ['$excessive_scrolls', 0] },
  first_seen: 1,
  last_seen: 1,
  duration_ms: 1,
  entry_page: 1,
  exit_page: 1,
  pages_visited: { $size: '$pages' },
  device: 1,
  browser: 1,
  os: 1,
  country: { $ifNull: ['$country', null] },
  referrer: { $ifNull: ['$referrer', null] },
  utm_source: { $ifNull: ['$utm_source', null] },
  utm_medium: { $ifNull: ['$utm_medium', null] },
  utm_campaign: { $ifNull: ['$utm_campaign', null] },
  source: 1,
};

// The segment's sessions (lib/filters.js), most recently active first, from the
// sessions collection that ingest keeps up to date (lib/sessionStore.js).
router.get('/sessions', async (req, res) => {
  const page = intParam(req.query.page, { fallback: 1, min: 1, max: 1_000_000 });
  const limit = intParam(req.query.limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  if (page === null || limit === null) {
    return res.status(400).json({ error: 'page and limit must each be given once' });
  }
  const parsed = parseFilters(req.query);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const [result] = await Session.aggregate([
    { $match: sessionMatch(parsed.filters) },
    { $sort: { last_seen: -1, session_id: 1 } }, // the { last_seen, session_id } index
    {
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: SESSION_FIELDS }],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  res.json({ data: result.data, page, limit, total: result.total[0]?.count ?? 0 });
});

// One session's journey, oldest first. _id breaks ties between same-millisecond events.
router.get('/sessions/:id/events', async (req, res) => {
  const { id } = req.params;
  if (!SESSION_ID_RE.test(id)) {
    return res.status(400).json({ error: 'Invalid session id' });
  }

  const [events, [session = null]] = await Promise.all([
    Event.find({ session_id: id }).sort({ timestamp: 1, _id: 1 }).lean(),
    Session.aggregate([{ $match: { session_id: id } }, { $project: SESSION_FIELDS }]),
  ]);
  if (events.length === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }
  // Clicks in a rage burst get rage: true; a page left again within 7 s gets quick_back: true.
  const { rage, quickBacks, excessiveScrolls } = findInsights(events);
  const marked = events.map((event) => ({
    ...event,
    ...(rage.has(event) && { rage: true }),
    ...(quickBacks.has(event) && { quick_back: true }),
    ...(excessiveScrolls.has(event) && { excessive_scroll: true }), // on the page view's latest exit
  }));
  // session: the same summary as a row of GET /api/sessions (null until it's built).
  res.json({ session_id: id, session, events: marked });
});

export default router;
