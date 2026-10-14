import express from 'express';
import { eventMatch, parseFilters } from '../lib/filters.js';
import { normalizeUrl } from '../lib/normalizeUrl.js';
import { DEVICES, Event } from '../models/Event.js';

export const HEATMAP_LIMIT = 5000;
const DEVICE_FILTERS = ['all', ...DEVICES];

const router = express.Router();

// Click positions on one page, newest first, capped at HEATMAP_LIMIT.
// total_clicks is the uncapped count, so the dashboard can say how many are hidden.
router.get('/heatmap', async (req, res) => {
  const { page, device = 'all' } = req.query;
  if (typeof page !== 'string' || page === '') {
    return res.status(400).json({ error: 'page is required (one page URL)' });
  }
  if (typeof device !== 'string' || !DEVICE_FILTERS.includes(device)) {
    return res.status(400).json({ error: `device must be one of: ${DEVICE_FILTERS.join(', ')}` });
  }

  // The segment picks the sessions; `device` above picks the layout to draw.
  const parsed = parseFilters(req.query);
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  let pageUrl;
  try {
    pageUrl = normalizeUrl(page); // same identity the events were stored under
  } catch {
    return res.status(400).json({ error: 'page must be a valid URL' });
  }

  const filter = {
    page_url: pageUrl,
    type: 'click',
    ...(device !== 'all' && { device }),
    ...(await eventMatch(parsed.filters)),
  };
  const [total_clicks, clicks] = await Promise.all([
    Event.countDocuments(filter),
    Event.find(filter, { _id: 0, x: 1, y: 1, doc_w: 1, doc_h: 1, viewport_w: 1, viewport_h: 1, device: 1 })
      .sort({ timestamp: -1 })
      .limit(HEATMAP_LIMIT)
      .lean(),
  ]);

  res.json({ page_url: pageUrl, device, total_clicks, clicks });
});

export default router;
