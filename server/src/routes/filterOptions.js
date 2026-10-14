import express from 'express';
import { parseFilters, rangeCondition } from '../lib/filters.js';
import { INSIGHTS } from '../lib/insights.js';
import { Session } from '../models/Session.js';

const MAX_VALUES = 100;

const router = express.Router();

/** Sessions per value of a field, most first. With `none`, a missing value is listed under that name. */
const values = (field, none) => [
  ...(none ? [] : [{ $match: { [field]: { $ne: null } } }]),
  { $group: { _id: none ? { $ifNull: [`$${field}`, none] } : `$${field}`, sessions: { $sum: 1 } } },
  { $sort: { sessions: -1, _id: 1 } },
  { $limit: MAX_VALUES },
  { $project: { _id: 0, value: '$_id', sessions: 1 } },
];

// The values the filter menus offer: what the sessions that started in the range
// actually have, with how many sessions have each. Only the date range applies,
// so choosing one filter doesn't empty the menus of the others.
router.get('/filters', async (req, res) => {
  const parsed = parseFilters({ from: req.query.from, to: req.query.to });
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const range = rangeCondition(parsed.filters);

  const [result] = await Session.aggregate([
    ...(range ? [{ $match: { first_seen: range } }] : []), // the { first_seen } index
    {
      $facet: {
        browsers: values('browser'),
        os: values('os'),
        countries: values('country', 'unknown'),
        referrers: values('referrer', 'direct'),
        utm_source: values('utm_source'),
        utm_medium: values('utm_medium'),
        utm_campaign: values('utm_campaign'),
        entry_pages: values('entry_page'),
        exit_pages: values('exit_page'),
        pages: [{ $unwind: '$pages' }, ...values('pages')],
        insights: [
          {
            $group: {
              _id: null,
              rage: { $sum: { $cond: [{ $gt: ['$rage_clicks', 0] }, 1, 0] } },
              dead: { $sum: { $cond: [{ $gt: ['$dead_clicks', 0] }, 1, 0] } },
              quick_back: { $sum: { $cond: [{ $gt: ['$quick_backs', 0] }, 1, 0] } },
            },
          },
        ],
      },
    },
  ]);

  // Every insight is listed, with 0 when no session has it, in the order the menus show them.
  const [counts = {}] = result.insights;
  res.json({ ...result, insights: INSIGHTS.map((value) => ({ value, sessions: counts[value] ?? 0 })) });
});

export default router;
