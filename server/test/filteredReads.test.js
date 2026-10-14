import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clickDoc, eventDoc, HOME, insert, PRODUCTS } from './factories.js';

// The filter bar's parameters (from, to, devices) on the endpoints that existed
// before M1b. Without them, these endpoints behave as before (their own tests).
const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (path, query) => request(app).get(path).query(query).set('Origin', DASHBOARD);

const DAY = 24 * 60 * 60;
const TODAY = { from: '2026-10-12T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' }; // BASE_TIME is 10:00 that day

describe('filters on GET /api/sessions', () => {
  it('keeps sessions that started in the range, on the chosen devices', async () => {
    await insert(
      eventDoc({ session_id: 'desk', at: 0 }),
      eventDoc({ session_id: 'phone', at: 60, device: 'mobile' }),
      eventDoc({ session_id: 'old', at: -DAY }),
    );

    const today = await get('/api/sessions', TODAY);
    expect(today.body.data.map((s) => s.session_id)).toEqual(['phone', 'desk']);
    expect(today.body.total).toBe(2);

    const phones = await get('/api/sessions', { ...TODAY, devices: 'mobile' });
    expect(phones.body.data.map((s) => s.session_id)).toEqual(['phone']);
    expect(phones.body.total).toBe(1);
  });

  it('rejects a bad range → 400', async () => {
    const res = await get('/api/sessions', { from: 'soon' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be an ISO 8601 date' });
  });
});

describe('filters on GET /api/pages', () => {
  it('counts only the events in the range, on the chosen devices', async () => {
    await insert(
      eventDoc({ at: 0, page_url: HOME }),
      clickDoc({ at: 5, page_url: HOME, device: 'mobile' }),
      eventDoc({ at: -DAY, page_url: PRODUCTS }),
    );

    const today = await get('/api/pages', TODAY);
    expect(today.body.data).toEqual([{ page_url: HOME, page_views: 1, clicks: 1, last_seen: expect.any(String) }]);

    const desktop = await get('/api/pages', { ...TODAY, devices: 'desktop' });
    expect(desktop.body.data).toEqual([{ page_url: HOME, page_views: 1, clicks: 0, last_seen: expect.any(String) }]);
  });

  it('rejects unknown devices → 400', async () => {
    const res = await get('/api/pages', { devices: 'fridge' });
    expect(res.status).toBe(400);
  });
});

describe('filters on GET /api/heatmap', () => {
  it('counts only the clicks in the range; its own device param still picks the layout', async () => {
    await insert(
      clickDoc({ page_url: HOME, at: 0, x: 1, y: 1 }),
      clickDoc({ page_url: HOME, at: -DAY, x: 2, y: 2 }),
      clickDoc({ page_url: HOME, at: 0, x: 3, y: 3, device: 'mobile' }),
    );

    const res = await get('/api/heatmap', { page: HOME, device: 'desktop', ...TODAY });
    expect(res.body.total_clicks).toBe(1);
    expect(res.body.clicks).toEqual([expect.objectContaining({ x: 1, y: 1 })]);

    // `devices` (the filter bar's) is ignored here: the layout device decides.
    const both = await get('/api/heatmap', { page: HOME, device: 'desktop', devices: 'mobile', ...TODAY });
    expect(both.body.total_clicks).toBe(1);
  });

  it('rejects a reversed range → 400', async () => {
    const res = await get('/api/heatmap', { page: HOME, from: TODAY.to, to: TODAY.from });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be before to' });
  });
});
