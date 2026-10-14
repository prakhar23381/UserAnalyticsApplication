import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clickDoc, eventDoc, HOME, insert, PRODUCTS } from './factories.js';

// The segment (lib/filters.js) on every read endpoint. Without filters, these
// endpoints behave as before (their own tests).
const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (path, query) => request(app).get(path).query(query).set('Origin', DASHBOARD);
const ids = (res) => res.body.data.map((s) => s.session_id).sort();

const DAY = 24 * 60 * 60;
const TODAY = { from: '2026-10-12T00:00:00.000Z', to: '2026-10-13T00:00:00.000Z' }; // BASE_TIME is 10:00 that day
const ABOUT = 'http://localhost:4000/demo/about.html';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

// desk: Chrome on a Mac, from Google, home → products, 2 clicks, 40 s, India
// phone: Safari on an iPhone, newsletter campaign, about only, no clicks, 5 s
// old: yesterday, desktop, direct
const seed = () =>
  insert(
    eventDoc({ session_id: 'desk', at: 0, page_url: HOME, user_agent: CHROME_MAC, referrer: 'https://www.google.com/', country: 'IN' }),
    clickDoc({ session_id: 'desk', at: 10, page_url: HOME, user_agent: CHROME_MAC, x: 1, y: 1 }),
    eventDoc({ session_id: 'desk', at: 20, page_url: PRODUCTS, user_agent: CHROME_MAC, referrer: HOME }),
    clickDoc({ session_id: 'desk', at: 40, page_url: PRODUCTS, user_agent: CHROME_MAC, x: 2, y: 2 }),
    eventDoc({
      session_id: 'phone',
      at: 60,
      page_url: ABOUT,
      raw_url: `${ABOUT}?utm_source=newsletter&utm_medium=email&utm_campaign=Spring, sale`,
      user_agent: SAFARI_IPHONE,
      device: 'mobile',
      viewport_w: 390,
      doc_w: 390,
    }),
    eventDoc({ session_id: 'phone', at: 65, page_url: ABOUT, user_agent: SAFARI_IPHONE, device: 'mobile', viewport_w: 390, doc_w: 390 }),
    eventDoc({ session_id: 'old', at: -DAY, page_url: PRODUCTS }),
    clickDoc({ session_id: 'old', at: -DAY + 5, page_url: PRODUCTS, x: 3, y: 3 }),
  );

describe('the segment on GET /api/sessions', () => {
  it.each([
    [{}, ['desk', 'old', 'phone']],
    [TODAY, ['desk', 'phone']],
    [{ devices: 'mobile' }, ['phone']],
    [{ browsers: 'Chrome' }, ['desk']],
    [{ os: 'iOS,Other' }, ['old', 'phone']],
    [{ countries: 'IN' }, ['desk']],
    [{ countries: 'unknown' }, ['old', 'phone']],
    [{ referrers: 'google.com' }, ['desk']],
    [{ referrers: 'direct' }, ['old', 'phone']],
    [{ utm_source: 'newsletter' }, ['phone']],
    [{ utm_campaign: 'Spring, sale' }, ['phone']],
    [{ utm_medium: 'social' }, []],
    [{ entry_page: HOME }, ['desk']],
    [{ exit_page: PRODUCTS }, ['desk', 'old']],
    [{ visited_page: PRODUCTS }, ['desk', 'old']],
    [{ min_duration: '10' }, ['desk']],
    [{ max_duration: '5' }, ['old', 'phone']],
    [{ min_pages: '2' }, ['desk', 'phone']],
    [{ min_clicks: '1', max_clicks: '1' }, ['old']],
    [{ ...TODAY, browsers: 'Chrome,Safari', min_clicks: '1' }, ['desk']],
  ])('%j keeps %j', async (query, expected) => {
    await seed();
    const res = await get('/api/sessions', query);
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(expected);
    expect(res.body.total).toBe(expected.length);
  });

  it('describes each session with the new fields', async () => {
    await seed();
    const res = await get('/api/sessions', { devices: 'mobile' });
    expect(res.body.data[0]).toMatchObject({
      session_id: 'phone',
      browser: 'Safari',
      os: 'iOS',
      country: null,
      referrer: null,
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'Spring, sale',
      source: 'newsletter',
      entry_page: ABOUT,
      exit_page: ABOUT,
    });
  });

  it('rejects a bad filter → 400', async () => {
    const res = await get('/api/sessions', { from: 'soon' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be an ISO 8601 date' });
  });
});

describe('the segment on GET /api/pages', () => {
  it("counts only the matching sessions' events", async () => {
    await seed();
    const today = await get('/api/pages', TODAY);
    expect(today.body.data.map(({ page_url, page_views, clicks }) => [page_url, page_views, clicks])).toEqual([
      [HOME, 1, 1],
      [PRODUCTS, 1, 1],
      [ABOUT, 2, 0],
    ]);

    const chrome = await get('/api/pages', { browsers: 'Chrome' });
    expect(chrome.body.data.map((page) => page.page_url)).toEqual([HOME, PRODUCTS]);
  });

  it('is empty when no session matches', async () => {
    await seed();
    const res = await get('/api/pages', { countries: 'FR' });
    expect(res.body).toEqual({ data: [] });
  });

  it('rejects unknown devices → 400', async () => {
    const res = await get('/api/pages', { devices: 'fridge' });
    expect(res.status).toBe(400);
  });
});

describe('the segment on GET /api/heatmap', () => {
  it("draws only the matching sessions' clicks; its own device param still picks the layout", async () => {
    await seed();
    const today = await get('/api/heatmap', { page: PRODUCTS, device: 'desktop', ...TODAY });
    expect(today.body.total_clicks).toBe(1);
    expect(today.body.clicks).toEqual([expect.objectContaining({ x: 2, y: 2 })]);

    const all = await get('/api/heatmap', { page: PRODUCTS, device: 'desktop' });
    expect(all.body.total_clicks).toBe(2);

    const direct = await get('/api/heatmap', { page: PRODUCTS, device: 'desktop', referrers: 'direct' });
    expect(direct.body.clicks).toEqual([expect.objectContaining({ x: 3, y: 3 })]);

    // A segment of phones has no desktop clicks to draw.
    const phones = await get('/api/heatmap', { page: PRODUCTS, device: 'desktop', devices: 'mobile' });
    expect(phones.body.total_clicks).toBe(0);
  });

  it('rejects a reversed range → 400', async () => {
    const res = await get('/api/heatmap', { page: HOME, from: TODAY.to, to: TODAY.from });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'from must be before to' });
  });
});

describe('the segment on GET /api/overview', () => {
  it('narrows the totals, top pages and breakdowns', async () => {
    await seed();
    const res = await get('/api/overview', { ...TODAY, browsers: 'Safari' });
    expect(res.body.totals).toMatchObject({ sessions: 1, page_views: 2, clicks: 0 });
    expect(res.body.previous).toMatchObject({ sessions: 0 });
    expect(res.body.top_pages).toEqual([{ page_url: ABOUT, page_views: 2 }]);
    expect(res.body.browsers).toEqual([{ value: 'Safari', sessions: 1 }]);
    expect(res.body.sources).toEqual([{ value: 'newsletter', sessions: 1 }]);
  });

  it('splits sessions by browser, country and source', async () => {
    await seed();
    const res = await get('/api/overview', TODAY);
    expect(res.body.browsers).toEqual([
      { value: 'Chrome', sessions: 1 },
      { value: 'Safari', sessions: 1 },
    ]);
    expect(res.body.countries).toEqual([
      { value: null, sessions: 1 },
      { value: 'IN', sessions: 1 },
    ]);
    expect(res.body.sources).toEqual([
      { value: 'google.com', sessions: 1 },
      { value: 'newsletter', sessions: 1 },
    ]);
  });
});
