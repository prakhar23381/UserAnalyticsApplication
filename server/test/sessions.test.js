import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clickDoc, eventDoc, HOME, insert, iso, PRODUCTS } from './factories.js';

const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (path) => request(app).get(path).set('Origin', DASHBOARD);

describe('GET /api/sessions', () => {
  it('summarises each session', async () => {
    // Inserted out of order: the summary must follow timestamps, not insertion.
    await insert(
      clickDoc({ session_id: 'a', at: 31, page_url: PRODUCTS }),
      eventDoc({ session_id: 'a', at: 0, page_url: HOME }),
      clickDoc({ session_id: 'a', at: 5, page_url: HOME }),
      eventDoc({ session_id: 'a', at: 20, page_url: PRODUCTS }),
      clickDoc({ session_id: 'a', at: 30, page_url: PRODUCTS }),
    );

    const res = await get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: [
        {
          session_id: 'a',
          event_count: 5,
          page_views: 2,
          clicks: 3,
          rage_clicks: 0,
          dead_clicks: 0,
          quick_backs: 0,
          first_seen: iso(0),
          last_seen: iso(31),
          duration_ms: 31_000,
          entry_page: HOME,
          exit_page: PRODUCTS,
          pages_visited: 2,
          device: 'desktop',
          browser: 'Other',
          os: 'Other',
          country: null,
          referrer: null,
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          source: 'Direct',
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    });
  });

  it('lists the most recently active session first', async () => {
    await insert(
      eventDoc({ session_id: 'old', at: 0 }),
      eventDoc({ session_id: 'new', at: 600 }),
      eventDoc({ session_id: 'mid', at: 300 }),
    );
    const res = await get('/api/sessions');
    expect(res.body.data.map((s) => s.session_id)).toEqual(['new', 'mid', 'old']);
  });

  it('paginates and reports the total', async () => {
    await insert(['a', 'b', 'c'].map((session_id, i) => eventDoc({ session_id, at: i })));

    const first = await get('/api/sessions?page=1&limit=2');
    expect(first.body).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(first.body.data.map((s) => s.session_id)).toEqual(['c', 'b']);

    const second = await get('/api/sessions?page=2&limit=2');
    expect(second.body.data.map((s) => s.session_id)).toEqual(['a']);
  });

  it.each([
    ['limit=1000', { page: 1, limit: 100 }],
    ['limit=0', { page: 1, limit: 1 }],
    ['limit=abc', { page: 1, limit: 20 }],
    ['page=-3', { page: 1, limit: 20 }],
  ])('clamps %s', async (query, expected) => {
    const res = await get(`/api/sessions?${query}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(expected);
  });

  it('rejects a repeated query param → 400', async () => {
    const res = await get('/api/sessions?page=1&page=2');
    expect(res.status).toBe(400);
  });

  it('returns an empty page when nothing is tracked', async () => {
    const res = await get('/api/sessions');
    expect(res.body).toEqual({ data: [], page: 1, limit: 20, total: 0 });
  });

  it('lets only the dashboard read it (CORS)', async () => {
    const ok = await get('/api/sessions');
    expect(ok.headers['access-control-allow-origin']).toBe(DASHBOARD);

    const other = await request(app).get('/api/sessions').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('GET /api/sessions/:id/events', () => {
  it('returns the journey oldest first', async () => {
    await insert(
      clickDoc({ session_id: 'a', at: 30 }),
      eventDoc({ session_id: 'a', at: 0 }),
      eventDoc({ session_id: 'b', at: 10 }),
      clickDoc({ session_id: 'a', at: 12 }),
    );

    const res = await get('/api/sessions/a/events');
    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe('a');
    expect(res.body.session).toMatchObject({ session_id: 'a', event_count: 3, clicks: 2, browser: 'Other', source: 'Direct' });
    expect(res.body.events.map((e) => [e.type, e.timestamp])).toEqual([
      ['page_view', iso(0)],
      ['click', iso(12)],
      ['click', iso(30)],
    ]);
  });

  it('keeps same-millisecond events in the order they arrived', async () => {
    await insert(
      eventDoc({ session_id: 'a', at: 5 }),
      clickDoc({ session_id: 'a', at: 5, x: 1 }),
      clickDoc({ session_id: 'a', at: 5, x: 2 }),
    );
    const res = await get('/api/sessions/a/events');
    expect(res.body.events.map((e) => e.x ?? null)).toEqual([null, 1, 2]);
  });

  it('answers an unknown session with 404', async () => {
    const res = await get('/api/sessions/nobody/events');
    expect(res.status).toBe(404);
  });

  it('answers a malformed session id with 400', async () => {
    const res = await get('/api/sessions/bad$id/events');
    expect(res.status).toBe(400);
  });
});
