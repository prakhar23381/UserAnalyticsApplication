import express from 'express';
import { Event } from '../models/Event.js';

const router = express.Router();

// Every tracked page, for the heatmap's page picker. Most-clicked first.
router.get('/pages', async (req, res) => {
  const data = await Event.aggregate([
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
