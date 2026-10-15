import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { eventDoc, HOME, insert, PRODUCTS } from './factories.js';

const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (query) => request(app).get('/api/engagement').query(query).set('Origin', DASHBOARD);

const exit = ({ pv_id, at, active_ms, ...rest }) =>
  eventDoc({ type: 'page_exit', pv_id, at, scroll_depth: 1500, scroll_distance: 600, active_ms, bands: [active_ms], ...rest });

describe('GET /api/engagement', () => {
  it("returns each page view's latest totals, newest first", async () => {
    await insert(
      exit({ session_id: 'a', pv_id: 'v1', at: 10, active_ms: 1000 }),
      exit({ session_id: 'a', pv_id: 'v1', at: 30, active_ms: 4000 }), // the same view, later: wins
      exit({ session_id: 'b', pv_id: 'v2', at: 20, active_ms: 2000, scroll_depth: 900 }),
      exit({ session_id: 'b', pv_id: 'v3', at: 25, active_ms: 9000, page_url: PRODUCTS }), // another page
      eventDoc({ session_id: 'a', at: 0, pv_id: 'v1' }), // a page view, not a summary
    );

    const res = await get({ page: HOME });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      page_url: HOME,
      device: 'all',
      page_views: 2,
      views: [
        { scroll_depth: 1500, scroll_distance: 600, active_ms: 4000, bands: [4000], viewport_w: 1440, viewport_h: 900, doc_w: 1440, doc_h: 2400, device: 'desktop' },
        { scroll_depth: 900, scroll_distance: 600, active_ms: 2000, bands: [2000], viewport_w: 1440, viewport_h: 900, doc_w: 1440, doc_h: 2400, device: 'desktop' },
      ],
    });
  });

  it('follows the device and the segment', async () => {
    await insert(
      exit({ session_id: 'desk', pv_id: 'v1', at: 0, active_ms: 1000 }),
      exit({ session_id: 'phone', pv_id: 'v2', at: 0, active_ms: 2000, device: 'mobile', viewport_w: 375, doc_w: 375 }),
    );
    expect((await get({ page: HOME, device: 'mobile' })).body.views.map((v) => v.active_ms)).toEqual([2000]);
    expect((await get({ page: HOME, devices: 'desktop' })).body.views.map((v) => v.active_ms)).toEqual([1000]);
  });

  it('is empty without summaries, and rejects bad input → 400', async () => {
    expect((await get({ page: HOME })).body).toMatchObject({ page_views: 0, views: [] });
    expect((await get({})).status).toBe(400);
  });
});
