import express from 'express';
import { parseFilters, withFilters } from '../lib/filters.js';
import { Event } from '../models/Event.js';

const router = express.Router();

// Every tracked page, for the heatmap's page picker. Most-clicked first.
router.get('/pages', async (req, res) => {
  const parsed = parseFilters(req.query);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });
  const match = withFilters({}, parsed.filters, { field: 'timestamp', deviceField: 'device' });

  const data = await Event.aggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    { $sort: { page_url: 1 } }, // walks the { page_url, type, device } index
    {
      $group: {
        _id: '$page_url',
        page_views: { $sum: { $cond: [{ $eq: ['$type', 'page_view'] }, 1, 0] } },
        clicks: { $sum: { $cond: [{ $eq: ['$type', 'click'] }, 1, 0] } },
        last_seen: { $max: '$timestamp' },
      },
    },
    { $sort: { clicks: -1, _id: 1 } },
    { $project: { _id: 0, page_url: '$_id', page_views: 1, clicks: 1, last_seen: 1 } },
  ]);

  res.json({ data });
});

export default router;
