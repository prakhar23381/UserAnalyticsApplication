import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clickDoc, eventDoc, HOME, insert, iso, PRODUCTS } from './factories.js';

const app = createApp({ dashboardOrigins: ['http://localhost:3000'] });

describe('GET /api/pages', () => {
  it('lists every page with its views and clicks, most-clicked first', async () => {
    await insert(
      eventDoc({ page_url: HOME, at: 0 }),
      clickDoc({ page_url: HOME, at: 4 }),
      eventDoc({ page_url: PRODUCTS, at: 10 }),
      eventDoc({ page_url: PRODUCTS, session_id: 's_2', at: 50 }),
      clickDoc({ page_url: PRODUCTS, at: 12 }),
      clickDoc({ page_url: PRODUCTS, at: 13 }),
    );

    const res = await request(app).get('/api/pages');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        { page_url: PRODUCTS, page_views: 2, clicks: 2, last_seen: iso(50) },
        { page_url: HOME, page_views: 1, clicks: 1, last_seen: iso(4) },
      ],
    });
  });

  it('returns an empty list when nothing is tracked', async () => {
    const res = await request(app).get('/api/pages');
    expect(res.body).toEqual({ data: [] });
  });
});
