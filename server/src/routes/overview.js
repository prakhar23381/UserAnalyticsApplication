import express from 'express';
import { parseFilters, sessionMatch } from '../lib/filters.js';
import { Event } from '../models/Event.js';
import { Session } from '../models/Session.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SERIES_DAYS = 400; // beyond this, days without sessions aren't filled in
const TOP_PAGES = 5;
const TOP_VALUES = 5; // browsers, countries, sources

const router = express.Router();

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;
const utcDay = (date) => date.toISOString().slice(0, 10);

// Totals over a set of session documents.
const TOTALS = [
  {
    $group: {
      _id: null,
      sessions: { $sum: 1 },
      page_views: { $sum: '$page_views' },
      clicks: { $sum: '$clicks' },
      duration_ms: { $avg: '$duration_ms' },
      bounces: { $sum: { $cond: [{ $lte: ['$page_views', 1] }, 1, 0] } },
      rage_sessions: { $sum: { $cond: [{ $gt: ['$rage_clicks', 0] }, 1, 0] } },
      dead_sessions: { $sum: { $cond: [{ $gt: ['$dead_clicks', 0] }, 1, 0] } },
      quick_back_sessions: { $sum: { $cond: [{ $gt: ['$quick_backs', 0] }, 1, 0] } },
      excessive_scroll_sessions: { $sum: { $cond: [{ $gt: ['$excessive_scrolls', 0] }, 1, 0] } },
    },
  },
];

function shapeTotals(row) {
  if (!row) {
    return {
      sessions: 0,
      page_views: 0,
      clicks: 0,
      avg_duration_ms: 0,
      pages_per_session: 0,
      bounce_rate: 0,
      rage_sessions: 0,
      dead_sessions: 0,
      quick_back_sessions: 0,
      excessive_scroll_sessions: 0,
    };
  }
  return {
    sessions: row.sessions,
    page_views: row.page_views,
    clicks: row.clicks,
    avg_duration_ms: Math.round(row.duration_ms),
    pages_per_session: round(row.page_views / row.sessions, 2),
    bounce_rate: round(row.bounces / row.sessions, 4), // share of sessions with at most one page view
    // sessions with at least one of each insight (lib/insights.js)
    rage_sessions: row.rage_sessions,
    dead_sessions: row.dead_sessions,
    quick_back_sessions: row.quick_back_sessions,
    excessive_scroll_sessions: row.excessive_scroll_sessions,
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

/** Sessions per value of a field, most first; a missing value counts as null. */
const breakdown = (field, limit) => [
  { $group: { _id: { $ifNull: [`$${field}`, null] }, sessions: { $sum: 1 } } },
  { $sort: { sessions: -1, _id: 1 } },
  ...(limit ? [{ $limit: limit }] : []),
  { $project: { _id: 0, value: '$_id', sessions: 1 } },
];

// Headline numbers for the segment: its sessions that started in the range, the
// same numbers for the period just before it, sessions per day (UTC), top pages,
// and the split by device, browser, country and source.
router.get('/overview', async (req, res) => {
  const parsed = parseFilters(req.query);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const { from } = parsed.filters;
  const to = parsed.filters.to ?? new Date();
  // The previous period has the same length and ends where this one starts. "All time" has none.
  const previousFrom = from && new Date(from.getTime() - (to.getTime() - from.getTime()));
  const others = sessionMatch(parsed.filters, { range: false });
  const current = { ...others, first_seen: { ...(from && { $gte: from }), $lt: to } };

  const [[result], currentIds] = await Promise.all([
    Session.aggregate([
      { $match: { ...others, first_seen: { ...(previousFrom && { $gte: previousFrom }), $lt: to } } },
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
          devices: [{ $match: current }, ...breakdown('device')],
          browsers: [{ $match: current }, ...breakdown('browser', TOP_VALUES)],
          countries: [{ $match: current }, ...breakdown('country', TOP_VALUES)],
          sources: [{ $match: current }, ...breakdown('source', TOP_VALUES)],
        },
      },
    ]),
    Session.distinct('session_id', current),
  ]);

  // Page views by the segment's sessions in the range.
  const topPages = await Event.aggregate([
    { $match: { session_id: { $in: currentIds }, type: 'page_view' } }, // the { session_id, timestamp } index
    { $group: { _id: '$page_url', page_views: { $sum: 1 } } },
    { $sort: { page_views: -1, _id: 1 } },
    { $limit: TOP_PAGES },
    { $project: { _id: 0, page_url: '$_id', page_views: 1 } },
  ]);

  // The series starts at `from`, or at the first day with a session for "all time".
  const firstDay = from ?? (result.series[0] && new Date(`${result.series[0]._id}T00:00:00.000Z`));
  res.json({
    range: { from: from?.toISOString() ?? null, to: to.toISOString() },
    totals: shapeTotals(result.current[0]),
    previous: previousFrom ? shapeTotals(result.previous[0]) : null,
    series: fillDays(result.series, firstDay, new Date(to.getTime() - 1)),
    top_pages: topPages,
    devices: result.devices.map((row) => ({ device: row.value, sessions: row.sessions })),
    browsers: result.browsers,
    countries: result.countries, // value null: no country recorded
    sources: result.sources,
  });
});

export default router;
