import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { clickDoc, eventDoc, HOME, insert, PRODUCTS } from './factories.js';

// Insights (lib/insights.js) through the API: stored on sessions, filtered on,
// counted in the overview and the filter menus, and marked on journeys.
const DASHBOARD = 'http://localhost:3000';
const app = createApp({ dashboardOrigins: [DASHBOARD] });
const get = (path, query = {}) => request(app).get(path).query(query).set('Origin', DASHBOARD);
const ids = (res) => res.body.data.map((s) => s.session_id).sort();

// rage: three quick clicks on one spot · dead: one flagged click · back: home → products → home in 3 s
// hunt: 9000 px scrolled on a 2400 px page · calm: none
const seed = () =>
  insert(
    eventDoc({ session_id: 'rage', at: 0 }),
    clickDoc({ session_id: 'rage', at: 5 }),
    clickDoc({ session_id: 'rage', at: 5.3 }),
    clickDoc({ session_id: 'rage', at: 5.6, dead: true }),
    eventDoc({ session_id: 'dead', at: 0 }),
    clickDoc({ session_id: 'dead', at: 2, dead: true }),
    eventDoc({ session_id: 'back', at: 0, page_url: HOME }),
    eventDoc({ session_id: 'back', at: 4, page_url: PRODUCTS }),
    eventDoc({ session_id: 'back', at: 7, page_url: HOME }),
    eventDoc({ session_id: 'hunt', at: 0, pv_id: 'h1' }),
    eventDoc({ session_id: 'hunt', type: 'page_exit', at: 30, pv_id: 'h1', scroll_depth: 2400, scroll_distance: 9000, active_ms: 30_000, bands: [] }),
    eventDoc({ session_id: 'calm', at: 0 }),
    clickDoc({ session_id: 'calm', at: 9 }),
  );

describe('insights on sessions', () => {
  it('stores each insight count on the session row', async () => {
    await seed();
    const res = await get('/api/sessions');
    const byId = Object.fromEntries(
      res.body.data.map((s) => [s.session_id, [s.rage_clicks, s.dead_clicks, s.quick_backs, s.excessive_scrolls]]),
    );
    expect(byId).toEqual({ rage: [1, 1, 0, 0], dead: [0, 1, 0, 0], back: [0, 0, 1, 0], hunt: [0, 0, 0, 1], calm: [0, 0, 0, 0] });
  });

  it('filters on insights; a session needs all of the listed ones', async () => {
    await seed();
    expect(ids(await get('/api/sessions', { insights: 'dead' }))).toEqual(['dead', 'rage']);
    expect(ids(await get('/api/sessions', { insights: 'rage,dead' }))).toEqual(['rage']);
    expect(ids(await get('/api/sessions', { insights: 'quick_back' }))).toEqual(['back']);
    expect((await get('/api/sessions', { insights: 'bored' })).status).toBe(400);
  });

  it('counts sessions with each insight in the overview', async () => {
    await seed();
    const res = await get('/api/overview');
    expect(res.body.totals).toMatchObject({ sessions: 5, rage_sessions: 1, dead_sessions: 2, quick_back_sessions: 1, excessive_scroll_sessions: 1 });
  });

  it('offers every insight in the filter menus, with session counts', async () => {
    await seed();
    const res = await get('/api/filters');
    expect(res.body.insights).toEqual([
      { value: 'rage', sessions: 1 },
      { value: 'dead', sessions: 2 },
      { value: 'quick_back', sessions: 1 },
      { value: 'excessive_scroll', sessions: 1 },
    ]);
  });

  it('marks the rage and quick-back events of a journey', async () => {
    await seed();
    const rage = await get('/api/sessions/rage/events');
    expect(rage.body.events.map((e) => [e.type, e.rage ?? false, e.dead ?? false])).toEqual([
      ['page_view', false, false],
      ['click', true, false],
      ['click', true, false],
      ['click', true, true],
    ]);

    const back = await get('/api/sessions/back/events');
    expect(back.body.events.map((e) => e.quick_back ?? false)).toEqual([false, true, false]);

    const hunt = await get('/api/sessions/hunt/events');
    expect(hunt.body.events.map((e) => [e.type, e.excessive_scroll ?? false])).toEqual([
      ['page_view', false],
      ['page_exit', true],
    ]);
    expect(ids(await get('/api/sessions', { insights: 'excessive_scroll' }))).toEqual(['hunt']);
  });
});
