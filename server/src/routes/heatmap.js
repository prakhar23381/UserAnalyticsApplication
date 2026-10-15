import express from 'express';
import { ELEMENT_KEY, elementKey } from '../lib/elements.js';
import { eventMatch, parseFilters } from '../lib/filters.js';
import { normalizeUrl } from '../lib/normalizeUrl.js';
import { DEVICES, Event } from '../models/Event.js';

export const HEATMAP_LIMIT = 5000;
export const ELEMENTS_LIMIT = 50;
export const ENGAGEMENT_LIMIT = 2000;
const DEVICE_FILTERS = ['all', ...DEVICES];

const router = express.Router();

/**
 * The events of one type on one page that a heatmap view draws: `page` and
 * `device` pick the page and its layout, the segment picks the sessions.
 * Returns `{ pageUrl, device, filter }` or `{ error }`.
 */
async function pageEvents(query, type) {
  const { page, device = 'all' } = query;
  if (typeof page !== 'string' || page === '') return { error: 'page is required (one page URL)' };
  if (typeof device !== 'string' || !DEVICE_FILTERS.includes(device)) {
    return { error: `device must be one of: ${DEVICE_FILTERS.join(', ')}` };
  }
  const parsed = parseFilters(query);
  if (!parsed.ok) return { error: parsed.error };

  let pageUrl;
  try {
    pageUrl = normalizeUrl(page); // same identity the events were stored under
  } catch {
    return { error: 'page must be a valid URL' };
  }
  const filter = {
    page_url: pageUrl, // the { page_url, type, device } index
    type,
    ...(device !== 'all' && { device }),
    ...(await eventMatch(parsed.filters)),
  };
  return { pageUrl, device, filter };
}

// Click positions on one page, newest first, capped at HEATMAP_LIMIT. Each click
// names its element (`key`, lib/elements.js) and, when the tracker recorded it,
// the element's box. total_clicks is uncapped, so the dashboard can say how many are hidden.
router.get('/heatmap', async (req, res) => {
  const clicks = await pageEvents(req.query, 'click');
  if (clicks.error) return res.status(400).json({ error: clicks.error });
  const { pageUrl, device, filter } = clicks;

  const [total_clicks, docs] = await Promise.all([
    Event.countDocuments(filter),
    Event.find(filter, { _id: 0, x: 1, y: 1, doc_w: 1, doc_h: 1, viewport_w: 1, viewport_h: 1, device: 1, target: 1 })
      .sort({ timestamp: -1 })
      .limit(HEATMAP_LIMIT)
      .lean(),
  ]);

  res.json({
    page_url: pageUrl,
    device,
    total_clicks,
    clicks: docs.map(({ target, ...click }) => ({ ...click, key: elementKey(target), ...(target?.box && { box: target.box }) })),
  });
});

// The page's elements ranked by clicks, for the heatmap's sidebar: the top
// ELEMENTS_LIMIT, each with its share of the page's clicks and how many sessions clicked it.
router.get('/elements', async (req, res) => {
  const clicks = await pageEvents(req.query, 'click');
  if (clicks.error) return res.status(400).json({ error: clicks.error });
  const { pageUrl, device, filter } = clicks;

  const [result] = await Event.aggregate([
    { $match: filter },
    {
      $group: {
        _id: ELEMENT_KEY,
        clicks: { $sum: 1 },
        sessions: { $addToSet: '$session_id' },
        target: { $top: { sortBy: { timestamp: -1 }, output: '$target' } }, // the newest click's names
        selector: { $max: '$target.selector' }, // one group shares one selector; older clicks have none
      },
    },
    {
      $facet: {
        totals: [{ $group: { _id: null, elements: { $sum: 1 }, clicks: { $sum: '$clicks' } } }],
        top: [{ $sort: { clicks: -1, _id: 1 } }, { $limit: ELEMENTS_LIMIT }],
      },
    },
  ]);

  const totalClicks = result.totals[0]?.clicks ?? 0;
  res.json({
    page_url: pageUrl,
    device,
    total_clicks: totalClicks,
    total_elements: result.totals[0]?.elements ?? 0,
    elements: result.top.map((row, i) => ({
      rank: i + 1,
      key: row._id,
      selector: row.selector ?? null,
      tag: row.target?.tag ?? null,
      id: row.target?.id ?? null,
      classes: row.target?.classes ?? null,
      text: row.target?.text ?? null,
      clicks: row.clicks,
      share: Math.round((row.clicks / totalClicks) * 10_000) / 10_000,
      sessions: row.sessions.length,
    })),
  });
});

// Page-view summaries for the scroll and attention maps: the latest page_exit of
// each page view (its running totals), newest first, capped at ENGAGEMENT_LIMIT.
// page_views is the uncapped count of page views with a summary.
router.get('/engagement', async (req, res) => {
  const exits = await pageEvents(req.query, 'page_exit');
  if (exits.error) return res.status(400).json({ error: exits.error });
  const { pageUrl, device, filter } = exits;

  const [result] = await Event.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$pv_id',
        latest: {
          $top: {
            sortBy: { timestamp: -1, _id: -1 },
            output: {
              timestamp: '$timestamp',
              scroll_depth: '$scroll_depth',
              scroll_distance: '$scroll_distance',
              active_ms: '$active_ms',
              bands: '$bands',
              viewport_w: '$viewport_w',
              viewport_h: '$viewport_h',
              doc_w: '$doc_w',
              doc_h: '$doc_h',
              device: '$device',
            },
          },
        },
      },
    },
    {
      $facet: {
        total: [{ $count: 'count' }],
        views: [{ $sort: { 'latest.timestamp': -1, _id: 1 } }, { $limit: ENGAGEMENT_LIMIT }],
      },
    },
  ]);

  res.json({
    page_url: pageUrl,
    device,
    page_views: result.total[0]?.count ?? 0,
    views: result.views.map(({ latest: { timestamp, ...view } }) => view),
  });
});

export default router;
