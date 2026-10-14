import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { eventDoc, HOME, insert, PRODUCTS } from './factories.js';

const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (query) => request(app).get('/api/filters').query(query).set('Origin', DASHBOARD);

const DAY = 24 * 60 * 60;
const FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';

describe('GET /api/filters', () => {
  it('lists the values in the range with session counts, most common first', async () => {
    await insert(
      eventDoc({ session_id: 'a', at: 0, user_agent: FIREFOX, country: 'DE', referrer: 'https://news.example/' }),
      eventDoc({ session_id: 'a', at: 5, page_url: PRODUCTS }),
      eventDoc({ session_id: 'b', at: 60, raw_url: `${HOME}?utm_source=newsletter&utm_campaign=spring`, user_agent: FIREFOX }),
      eventDoc({ session_id: 'old', at: -2 * DAY, country: 'FR' }),
    );

    const res = await get({ from: '2026-10-12T00:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      browsers: [{ value: 'Firefox', sessions: 2 }],
      os: [{ value: 'Windows', sessions: 2 }],
      countries: [
        { value: 'DE', sessions: 1 },
        { value: 'unknown', sessions: 1 },
      ],
      referrers: [
        { value: 'direct', sessions: 1 },
        { value: 'news.example', sessions: 1 },
      ],
      utm_source: [{ value: 'newsletter', sessions: 1 }],
      utm_medium: [],
      utm_campaign: [{ value: 'spring', sessions: 1 }],
      entry_pages: [{ value: HOME, sessions: 2 }],
      exit_pages: [
        { value: HOME, sessions: 1 },
        { value: PRODUCTS, sessions: 1 },
      ],
      pages: [
        { value: HOME, sessions: 2 },
        { value: PRODUCTS, sessions: 1 },
      ],
    });
  });

  it('covers all time without a range', async () => {
    await insert(eventDoc({ session_id: 'old', at: -2 * DAY, country: 'FR' }));
    const res = await get({});
    expect(res.body.countries).toEqual([{ value: 'FR', sessions: 1 }]);
  });

  it('rejects a bad range → 400', async () => {
    const res = await get({ to: 'later' });
    expect(res.status).toBe(400);
  });

  it('lets only the dashboard read it (CORS)', async () => {
    const res = await request(app).get('/api/filters').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
