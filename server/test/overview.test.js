import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clickDoc, eventDoc, HOME, insert, PRODUCTS } from './factories.js';

const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const overview = (query = {}) => request(app).get('/api/overview').query(query).set('Origin', DASHBOARD);

const DAY = 24 * 60 * 60;
// BASE_TIME is 2026-10-12T10:00Z: "today" is 2026-10-12, the previous day is the previous period.
const RANGE = { from: '2026-10-12T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' };

const seed = () =>
  insert(
    // a: desktop, two pages and a click, 60 s
    eventDoc({ session_id: 'a', at: 0, page_url: HOME }),
    clickDoc({ session_id: 'a', at: 10, page_url: HOME }),
    eventDoc({ session_id: 'a', at: 60, page_url: PRODUCTS }),
    // b: phone, one page (a bounce)
    eventDoc({ session_id: 'b', at: 3600, device: 'mobile', viewport_w: 390, doc_w: 390 }),
    // p: the day before, in the previous period
    eventDoc({ session_id: 'p', at: -DAY, page_url: HOME }),
    clickDoc({ session_id: 'p', at: -DAY + 10, page_url: HOME }),
    // z: ten days before, in neither period
    eventDoc({ session_id: 'z', at: -10 * DAY }),
  );

describe('GET /api/overview', () => {
  it('summarises the range, the period before it, the days, pages and devices', async () => {
    await seed();
    const res = await overview(RANGE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      range: RANGE,
      totals: { sessions: 2, page_views: 3, clicks: 1, avg_duration_ms: 30_000, pages_per_session: 1.5, bounce_rate: 0.5, rage_sessions: 0, dead_sessions: 0, quick_back_sessions: 0 },
      previous: { sessions: 1, page_views: 1, clicks: 1, avg_duration_ms: 10_000, pages_per_session: 1, bounce_rate: 1, rage_sessions: 0, dead_sessions: 0, quick_back_sessions: 0 },
      series: [{ date: '2026-10-12', sessions: 2 }],
      top_pages: [
        { page_url: HOME, page_views: 2 },
        { page_url: PRODUCTS, page_views: 1 },
      ],
      devices: [
        { device: 'desktop', sessions: 1 },
        { device: 'mobile', sessions: 1 },
      ],
      browsers: [{ value: 'Other', sessions: 2 }], // the factories store no user agent
      countries: [{ value: null, sessions: 2 }],
      sources: [{ value: 'Direct', sessions: 2 }],
    });
  });

  it('narrows everything to the chosen devices', async () => {
    await seed();
    const res = await overview({ ...RANGE, devices: 'mobile' });
    expect(res.body.totals).toMatchObject({ sessions: 1, page_views: 1, bounce_rate: 1 });
    expect(res.body.previous).toMatchObject({ sessions: 0, page_views: 0 });
    expect(res.body.top_pages).toEqual([{ page_url: HOME, page_views: 1 }]);
    expect(res.body.devices).toEqual([{ device: 'mobile', sessions: 1 }]);
  });

  it('fills days without sessions with 0', async () => {
    await insert(eventDoc({ session_id: 'a', at: 0 }));
    const res = await overview({ from: '2026-10-11T00:00:00.000Z', to: '2026-10-14T00:00:00.000Z' });
    expect(res.body.series).toEqual([
      { date: '2026-10-11', sessions: 0 },
      { date: '2026-10-12', sessions: 1 },
      { date: '2026-10-13', sessions: 0 },
    ]);
  });

  it('covers all time without a range: no previous period, days from the first session to today', async () => {
    await seed();
    const res = await overview();
    expect(res.body.range.from).toBeNull();
    expect(res.body.previous).toBeNull();
    expect(res.body.totals.sessions).toBe(4);
    expect(res.body.series[0]).toEqual({ date: '2026-10-02', sessions: 1 });
    expect(res.body.series.at(-1).date).toBe(new Date(Date.now() - 1).toISOString().slice(0, 10));
  });

  it('returns zeros, not errors, when nothing matches', async () => {
    const res = await overview(RANGE);
    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ sessions: 0, page_views: 0, clicks: 0, avg_duration_ms: 0, pages_per_session: 0, bounce_rate: 0, rage_sessions: 0, dead_sessions: 0, quick_back_sessions: 0 });
    expect(res.body.series).toEqual([{ date: '2026-10-12', sessions: 0 }]);
    expect(res.body.top_pages).toEqual([]);
    expect(res.body.devices).toEqual([]);
  });

  it.each([
    [{ from: 'last week' }],
    [{ from: '2026-10-13', to: '2026-10-12' }],
    [{ devices: 'watch' }],
  ])('rejects bad filters %j → 400', async (query) => {
    const res = await overview(query);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });

  it('lets only the dashboard read it (CORS)', async () => {
    const res = await request(app).get('/api/overview').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
