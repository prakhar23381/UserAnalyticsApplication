import express from 'express';
import { parseFilters, withFilters } from '../lib/filters.js';
import { Event } from '../models/Event.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SERIES_DAYS = 400; // beyond this, days without sessions aren't filled in
const TOP_PAGES = 5;

const router = express.Router();

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
const utcDay = (date) => date.toISOString().slice(0, 10);

// Totals over a set of session summaries (see the $group below).
const TOTALS = [
  {
    $group: {
      _id: null,
      sessions: { $sum: 1 },
      page_views: { $sum: '$page_views' },
      clicks: { $sum: '$clicks' },
      duration_ms: { $avg: { $subtract: ['$last_seen', '$first_seen'] } },
      bounces: { $sum: { $cond: [{ $lte: ['$page_views', 1] }, 1, 0] } },
    },
  },
];

function shapeTotals(row) {
  if (!row) {
    return { sessions: 0, page_views: 0, clicks: 0, avg_duration_ms: 0, pages_per_session: 0, bounce_rate: 0 };
  }
  return {
    sessions: row.sessions,
    page_views: row.page_views,
    clicks: row.clicks,
    avg_duration_ms: Math.round(row.duration_ms),
    pages_per_session: round(row.page_views / row.sessions, 2),
    bounce_rate: round(row.bounces / row.sessions, 4), // share of sessions with at most one page view
  };
}

/** One entry per UTC day from `first` to `last`, with 0 for days without sessions. */
function fillDays(rows, first, last) {
  const byDay = new Map(rows.map((row) => [row._id, row.sessions]));
  if (!first || (last - first) / DAY_MS > MAX_SERIES_DAYS) {
    return rows.map((row) => ({ date: row._id, sessions: row.sessions }));
  }
  const series = [];
  for (let day = Date.parse(utcDay(first)); day <= last.getTime(); day += DAY_MS) {
    const date = utcDay(new Date(day));
    series.push({ date, sessions: byDay.get(date) ?? 0 });
  }
  return series;
}

// Headline numbers for the filter bar's segment: sessions that started in the
// range on the chosen devices, the same numbers for the period just before it,
// sessions per day (UTC), top pages and the device split. Sessions are built
// from events on read, like GET /api/sessions; M2 moves this to a sessions collection.
router.get('/overview', async (req, res) => {
  const parsed = parseFilters(req.query);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { from, devices } = parsed.filters;
  const to = parsed.filters.to ?? new Date();
  // The previous period has the same length and ends where this one starts. "All time" has none.
  const previousFrom = from && new Date(from.getTime() - (to.getTime() - from.getTime()));
  const current = { first_seen: { ...(from && { $gte: from }), $lt: to } };

  const [[result], topPages] = await Promise.all([
    Event.aggregate([
      { $sort: { session_id: 1, timestamp: 1 } }, // walks the { session_id, timestamp } index
      {
        $group: {
          _id: '$session_id',
          first_seen: { $first: '$timestamp' },
          last_seen: { $last: '$timestamp' },
          device: { $first: '$device' },
          page_views: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
        },
      },
      { $match: withFilters({}, { from: previousFrom, to, devices }, { field: 'first_seen', deviceField: 'device' }) },
      {
        $facet: {
          current: [{ $match: current }, ...TOTALS],
          // ($limit: 0 is invalid, so "all time" leaves this facet out.)
          ...(previousFrom && { previous: [{ $match: { first_seen: { $lt: from } } }, ...TOTALS] }),
          series: [
            { $match: current },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$first_seen', timezone: 'UTC' } }, sessions: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          devices: [
            { $match: current },
            { $group: { _id: '$device', sessions: { $sum: 1 } } },
            { $sort: { sessions: -1, _id: 1 } },
          ],
        },
      },
    ]),
    Event.aggregate([
      { $match: withFilters({ type: 'page_view' }, { from, to, devices }, { field: 'timestamp', deviceField: 'device' }) },
      { $group: { _id: '$page_url', page_views: { $sum: 1 } } },
      { $sort: { page_views: -1, _id: 1 } },
      { $limit: TOP_PAGES },
      { $project: { _id: 0, page_url: '$_id', page_views: 1 } },
    ]),
  ]);

  // The series starts at `from`, or at the first day with a session for "all time".
  const firstDay = from ?? (result.series[0] && new Date(`${result.series[0]._id}T00:00:00.000Z`));
  res.json({
    range: { from: from?.toISOString() ?? null, to: to.toISOString() },
    totals: shapeTotals(result.current[0]),
    previous: previousFrom ? shapeTotals(result.previous[0]) : null,
    series: fillDays(result.series, firstDay, new Date(to.getTime() - 1)),
    top_pages: topPages,
    devices: result.devices.map((row) => ({ device: row._id, sessions: row.sessions })),
  });
});

export default router;
