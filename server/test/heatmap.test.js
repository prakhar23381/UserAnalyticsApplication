import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { HEATMAP_LIMIT } from '../src/routes/heatmap.js';
import { clickDoc, eventDoc, HOME, insert, PRODUCTS } from './factories.js';

const app = createApp({ dashboardOrigins: ['http://localhost:3000'] });
const heatmap = (query) => request(app).get('/api/heatmap').query(query);

describe('GET /api/heatmap', () => {
  it("returns only this page's clicks, newest first, with just the fields a heatmap needs", async () => {
    await insert(
      clickDoc({ page_url: PRODUCTS, at: 1, x: 10, y: 11 }),
      clickDoc({ page_url: PRODUCTS, at: 2, x: 20, y: 21 }),
      eventDoc({ page_url: PRODUCTS, at: 0 }), // a page_view, not a click
      clickDoc({ page_url: HOME, at: 3, x: 30, y: 31 }), // another page
    );

    const res = await heatmap({ page: PRODUCTS });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      page_url: PRODUCTS,
      device: 'all',
      total_clicks: 2,
      clicks: [
        { x: 20, y: 21, doc_w: 1440, doc_h: 2400, viewport_w: 1440, viewport_h: 900, device: 'desktop', key: '?' },
        { x: 10, y: 11, doc_w: 1440, doc_h: 2400, viewport_w: 1440, viewport_h: 900, device: 'desktop', key: '?' },
      ],
    });
  });

  it('normalizes the page param the same way events were stored', async () => {
    await insert(clickDoc({ page_url: HOME }));
    const res = await heatmap({ page: 'http://localhost:4000/demo/index.html?utm_source=ad#top' });
    expect(res.body).toMatchObject({ page_url: HOME, total_clicks: 1 });
  });

  it('filters by device', async () => {
    await insert(
      clickDoc({ page_url: HOME, device: 'desktop' }),
      clickDoc({ page_url: HOME, device: 'mobile', viewport_w: 375, doc_w: 375 }),
      clickDoc({ page_url: HOME, device: 'mobile', viewport_w: 390, doc_w: 390 }),
    );

    const mobile = await heatmap({ page: HOME, device: 'mobile' });
    expect(mobile.body.total_clicks).toBe(2);
    expect(mobile.body.clicks.every((c) => c.device === 'mobile')).toBe(true);

    const all = await heatmap({ page: HOME, device: 'all' });
    expect(all.body.total_clicks).toBe(3);
  });

  it(`caps the clicks at ${HEATMAP_LIMIT} but reports the full total`, async () => {
    await insert(Array.from({ length: HEATMAP_LIMIT + 1 }, (_, i) => clickDoc({ page_url: HOME, at: i })));
    const res = await heatmap({ page: HOME });
    expect(res.body.total_clicks).toBe(HEATMAP_LIMIT + 1);
    expect(res.body.clicks).toHaveLength(HEATMAP_LIMIT);
  });

  it.each([
    ['a missing page', '/api/heatmap'],
    ['a page that is not a URL', '/api/heatmap?page=products'],
    ['a repeated page', `/api/heatmap?page=${encodeURIComponent(HOME)}&page=${encodeURIComponent(PRODUCTS)}`],
    ['an unknown device', `/api/heatmap?page=${encodeURIComponent(HOME)}&device=watch`],
  ])('answers %s with 400', async (_, path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
});
