import express from 'express';
import { SESSION_ID_RE } from '../lib/validateEvent.js';
import { Event } from '../models/Event.js';

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

// Sessions are aggregated from events on read (no sessions collection).
router.get('/sessions', async (req, res) => {
  const page = intParam(req.query.page, { fallback: 1, min: 1, max: 1_000_000 });
  const limit = intParam(req.query.limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  if (page === null || limit === null) {
    return res.status(400).json({ error: 'page and limit must each be given once' });
  }

  const [result] = await Event.aggregate([
    { $sort: { session_id: 1, timestamp: 1 } }, // walks the { session_id, timestamp } index
    {
      $group: {
        _id: '$session_id',
        event_count: { $sum: 1 },
        page_views: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
        clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
        first_seen: { $first: '$timestamp' },
        last_seen: { $last: '$timestamp' },
        entry_page: { $first: '$page_url' },
        pages: { $addToSet: '$page_url' },
        device: { $first: '$device' },
      },
    },
    { $sort: { last_seen: -1, _id: 1 } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              session_id: '$_id',
              event_count: 1,
              page_views: 1,
              clicks: 1,
              first_seen: 1,
              last_seen: 1,
              duration_ms: { $subtract: ['$last_seen', '$first_seen'] },
              entry_page: 1,
              pages_visited: { $size: '$pages' },
              device: 1,
            },
          },
        ],
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

  const events = await Event.find({ session_id: id }).sort({ timestamp: 1, _id: 1 }).lean();
  if (events.length === 0) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ session_id: id, events });
});

export default router;
