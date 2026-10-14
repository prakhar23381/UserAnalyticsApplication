import { describe, expect, it } from 'vitest';
import { ensureSessions, rebuildAllSessions, rebuildSessions, summarize } from '../src/lib/sessionStore.js';
import { Event } from '../src/models/Event.js';
import { Session } from '../src/models/Session.js';
import { BASE_TIME, clickDoc, eventDoc, HOME, PRODUCTS } from './factories.js';

const ABOUT = 'http://localhost:4000/demo/about.html';
const stored = (id) => Session.findOne({ session_id: id }, { _id: 0, updated_at: 0 }).lean();

describe('summarize', () => {
  const events = [
    eventDoc({
      at: 0,
      page_url: HOME,
      raw_url: `${HOME}/index.html?utm_source=Instagram&utm_medium=social&utm_campaign=%20launch%20&utm_term=x`,
      referrer: 'https://www.L.Instagram.com/some/path',
      user_agent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
      device: 'mobile',
    }),
    clickDoc({ at: 4, page_url: HOME, country: 'IN' }),
    eventDoc({ at: 9, page_url: PRODUCTS, referrer: HOME }),
    eventDoc({ at: 30, page_url: HOME, referrer: PRODUCTS }),
  ];

  it('describes the session from its events, oldest first', () => {
    expect(summarize(events)).toEqual({
      session_id: 's_1',
      first_seen: new Date(BASE_TIME),
      last_seen: new Date(BASE_TIME + 30_000),
      duration_ms: 30_000,
      event_count: 4,
      page_views: 3,
      clicks: 1,
      rage_clicks: 0,
      dead_clicks: 0,
      quick_backs: 0,
      pages: [HOME, PRODUCTS],
      entry_page: HOME,
      exit_page: HOME,
      device: 'mobile',
      browser: 'Chrome',
      os: 'Android',
      country: 'IN',
      referrer: 'l.instagram.com',
      utm_source: 'Instagram',
      utm_medium: 'social',
      utm_campaign: 'launch',
      source: 'Instagram',
      updated_at: expect.any(Date),
    });
  });

  it('leaves out a referrer from the same site, and falls back to it or Direct for the source', () => {
    const internal = summarize([eventDoc({ referrer: `${HOME}/products.html` })]);
    expect(internal.referrer).toBeUndefined();
    expect(internal.source).toBe('Direct');

    const external = summarize([eventDoc({ referrer: 'https://www.google.com/' })]);
    expect(external).toMatchObject({ referrer: 'google.com', source: 'google.com' });
  });
});

describe('rebuildSessions', () => {
  it('creates, then updates, a session as its events arrive in any order', async () => {
    await Event.insertMany([eventDoc({ at: 20, page_url: PRODUCTS })]);
    await rebuildSessions(['s_1']);
    expect(await stored('s_1')).toMatchObject({ entry_page: PRODUCTS, event_count: 1 });

    // An earlier event arrives later: the entry page and start time move back.
    await Event.insertMany([eventDoc({ at: 0, page_url: HOME }), clickDoc({ at: 25, page_url: ABOUT })]);
    await rebuildSessions(['s_1', 's_1']);
    expect(await stored('s_1')).toMatchObject({
      entry_page: HOME,
      exit_page: ABOUT,
      first_seen: new Date(BASE_TIME),
      duration_ms: 25_000,
      event_count: 3,
      pages: [HOME, PRODUCTS, ABOUT],
    });
    expect(await Session.countDocuments()).toBe(1);
  });

  it('never replaces a summary built from more events', async () => {
    // A faster recompute already stored the summary of two events; this one read only the first.
    await Session.create(summarize([eventDoc({ at: 0 }), clickDoc({ at: 5 })]));
    await Event.insertMany([eventDoc({ at: 0 })]);
    await rebuildSessions(['s_1']);
    expect(await stored('s_1')).toMatchObject({ event_count: 2, clicks: 1 });
  });

  it('keeps the fuller summary when recomputes of one session race', async () => {
    await Event.insertMany(Array.from({ length: 5 }, (_, i) => clickDoc({ at: i })));
    await Promise.all(Array.from({ length: 8 }, () => rebuildSessions(['s_1'])));
    expect(await Session.countDocuments()).toBe(1);
    expect((await stored('s_1')).event_count).toBe(5);
  });

  it('removes a session whose events are gone', async () => {
    await Event.insertMany([eventDoc({ session_id: 'gone' })]);
    await rebuildSessions(['gone']);
    await Event.deleteMany({ session_id: 'gone' });
    await rebuildSessions(['gone']);
    expect(await Session.countDocuments()).toBe(0);
  });
});

describe('rebuildAllSessions and ensureSessions', () => {
  it('builds every session once when the collection is empty', async () => {
    await Event.insertMany([eventDoc({ session_id: 'a' }), eventDoc({ session_id: 'b' }), clickDoc({ session_id: 'b', at: 3 })]);
    expect(await ensureSessions()).toBe(2);
    expect((await stored('b')).clicks).toBe(1);

    // Not again once sessions exist.
    expect(await ensureSessions()).toBeNull();
    expect(await rebuildAllSessions()).toBe(2);
  });

  it('does nothing without events', async () => {
    expect(await ensureSessions()).toBeNull();
    expect(await Session.countDocuments()).toBe(0);
  });
});
