import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  LAYOUT,
  PAGES,
  SEED_PREFIX,
  generateSessions,
  isLocalUri,
  seed,
  toDocuments,
} from '../scripts/seed.js';
import { deviceFor } from '../src/lib/device.js';
import { normalizeUrl } from '../src/lib/normalizeUrl.js';
import { SESSION_ID_RE, validateEvent } from '../src/lib/validateEvent.js';
import { Event } from '../src/models/Event.js';
import { Session } from '../src/models/Session.js';
import { eventDoc, insert } from './factories.js';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const BASE = 'http://localhost:4000';

// mulberry32: a tiny seeded PRNG, so every run checks the same visits.
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sessions = generateSessions({ count: 200, baseUrl: BASE, now: NOW, random: seededRandom(42) });
const events = sessions.flatMap((session) => session.events);
const clicks = events.filter((event) => event.type === 'click');

// A click's target names its element by id, else classes, else text (see ELEMENTS).
const keyOf = (target) => target.id ?? target.classes ?? target.text;
const elementNames = Object.fromEntries(Object.entries(ELEMENTS).map(([name, { target }]) => [keyOf(target), name]));
const elementOf = (click) => elementNames[keyOf(click.target)];

describe('generateSessions', () => {
  it('makes the requested number of sessions, each with its own seed_ id', () => {
    expect(sessions).toHaveLength(200);
    const ids = sessions.map((session) => session.events[0].session_id);
    expect(new Set(ids).size).toBe(200);
    for (const id of ids) {
      expect(id.startsWith(SEED_PREFIX)).toBe(true);
      expect(id).toMatch(SESSION_ID_RE);
    }
    for (const session of sessions) {
      expect(new Set(session.events.map((event) => event.session_id)).size).toBe(1);
    }
  });

  it('sends only events the API accepts', () => {
    for (const event of events) expect(validateEvent(event).error).toBeUndefined();
  });

  it('starts every session with a page view and keeps it in order, within the last 7 days', () => {
    for (const session of sessions) {
      expect(session.events[0].type).toBe('page_view');
      const times = session.events.map((event) => Date.parse(event.timestamp));
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
      expect(times[0]).toBeGreaterThanOrEqual(NOW - 7 * DAY);
      expect(times.at(-1)).toBeLessThanOrEqual(NOW);
    }
  });

  it('covers every page and device, at the heatmap reference widths', () => {
    const pageUrls = Object.values(PAGES).map((path) => normalizeUrl(new URL(path, BASE).href));
    expect(new Set(events.map((event) => normalizeUrl(event.page_url)))).toEqual(new Set(pageUrls));
    expect(new Set(clicks.map((click) => normalizeUrl(click.page_url)))).toEqual(new Set(pageUrls));

    const devices = new Set(events.map((event) => deviceFor(event.viewport_w)));
    expect(devices).toEqual(new Set(['desktop', 'tablet', 'mobile']));
    for (const event of events) {
      expect(event.viewport_w).toBe(LAYOUT[deviceFor(event.viewport_w)].viewport[0]);
      expect(event.doc_w).toBe(event.viewport_w);
    }
  });

  it('has a box for every element at every width, within the page', () => {
    for (const { viewport, box } of Object.values(LAYOUT)) {
      expect(Object.keys(box).sort()).toEqual(Object.keys(ELEMENTS).sort());
      for (const [left, , width] of Object.values(box)) expect(left + width).toBeLessThanOrEqual(viewport[0]);
    }
  });

  it('puts every click inside the element it names', () => {
    for (const click of clicks) {
      const name = elementOf(click);
      const device = deviceFor(click.viewport_w);
      const [left, top, width, height] = LAYOUT[device].box[name];
      const inside = click.x >= left && click.x <= left + width && click.y >= top && click.y <= top + height;
      expect(inside, `${name} on ${device} at (${click.x}, ${click.y})`).toBe(true);
      expect(click.y).toBeLessThanOrEqual(click.doc_h);
    }
  });

  it('gives each click its element box from LAYOUT', () => {
    for (const click of clicks) {
      const [x, y, w, h] = LAYOUT[deviceFor(click.viewport_w)].box[elementOf(click)];
      expect(click.target.box).toEqual({ x, y, w, h });
    }
  });

  it("follows a link click with a view of the link's page, referred by the page before", () => {
    let links = 0;
    for (const session of sessions) {
      session.events.forEach((event, i) => {
        const opens = event.type === 'click' && ELEMENTS[elementOf(event)].opens;
        if (!opens) return;
        links++;
        const next = session.events[i + 1];
        expect(next.type).toBe('page_view');
        expect(normalizeUrl(next.page_url)).toBe(normalizeUrl(new URL(PAGES[opens], BASE).href));
        expect(next.referrer).toBe(event.page_url);
      });
    }
    expect(links).toBeGreaterThan(100);
  });

  it('shows the running cart count on the cart link', () => {
    let cartClicks = 0;
    for (const session of sessions) {
      let added = 0;
      for (const event of session.events) {
        if (event.target?.id === 'cart-link') {
          cartClicks++;
          expect(event.target.text).toBe(`Cart ${added}`);
        }
        if (event.target?.id?.startsWith('add-')) added++;
      }
    }
    expect(cartClicks).toBeGreaterThan(0);
  });
});

describe('toDocuments', () => {
  const documents = toDocuments(sessions);

  it('stores what POST /api/events would: normalized page_url, raw_url, device, user agent', () => {
    expect(documents).toHaveLength(events.length);
    documents.forEach((doc, i) => {
      expect(doc.raw_url).toBe(events[i].page_url);
      expect(doc.page_url).toBe(normalizeUrl(events[i].page_url));
      expect(doc.device).toBe(deviceFor(doc.viewport_w));
      expect(doc.user_agent).toMatch(/^Mozilla\/5\.0 /);
      expect(doc.received_at.getTime()).toBeGreaterThan(doc.timestamp.getTime());
    });
  });

  it('varies browsers, countries and campaigns, as the segment filters need', async () => {
    await seed(documents);
    const sessions = await Session.find().lean();
    expect(new Set(sessions.map((s) => s.browser)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(sessions.map((s) => s.os)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(sessions.map((s) => s.country)).size).toBeGreaterThanOrEqual(6);
    expect(sessions.some((s) => s.country === undefined)).toBe(true);
    expect(new Set(sessions.map((s) => s.utm_campaign).filter(Boolean))).toEqual(new Set(['october-beans', 'autumn-launch']));
    expect(sessions.every((s) => s.browser !== 'Other' && s.os !== 'Other')).toBe(true);
  });

  it('has rage clicks, dead clicks and quick backs, as the insights need', async () => {
    await seed(documents);
    const sessions = await Session.find().lean();
    const share = (field) => sessions.filter((s) => s[field] > 0).length / sessions.length;
    for (const field of ['rage_clicks', 'dead_clicks', 'quick_backs']) {
      expect(share(field), field).toBeGreaterThan(0.02);
      expect(share(field), field).toBeLessThan(0.3);
    }
    // Only the product photos, which do nothing, are dead.
    for (const click of clicks) expect(click.dead === true).toBe(elementOf(click).startsWith('img-'));
  });

  it('lands some visits on URL variants that normalize to the same page', () => {
    expect(documents.some((doc) => doc.raw_url.includes('?utm_source='))).toBe(true);
    expect(documents.some((doc) => doc.raw_url.endsWith('/demo/index.html'))).toBe(true);
    for (const doc of documents) expect(doc.page_url).not.toMatch(/[?#]|index\.html$/);
  });
});

describe('seed', () => {
  const documents = toDocuments(sessions.slice(0, 3));

  it('adds the documents and leaves earlier seeded sessions alone', async () => {
    await insert(eventDoc({ session_id: 'seed_earlier' }));
    expect(await seed(documents)).toEqual({ deleted: 0, inserted: documents.length, sessions: 3 });
    expect(await Event.countDocuments()).toBe(documents.length + 1);
    expect(await Session.countDocuments({ session_id: /^seed_/ })).toBe(4);
  });

  it('with reset, deletes earlier seeded sessions and keeps real ones', async () => {
    await insert(
      eventDoc({ session_id: 'seed_earlier' }),
      eventDoc({ session_id: 'real-visitor' }),
      eventDoc({ session_id: 'not_seed_1' }),
    );
    expect(await seed(documents, { reset: true })).toEqual({ deleted: 1, inserted: documents.length, sessions: 3 });
    expect(await Event.exists({ session_id: 'seed_earlier' })).toBeNull();
    expect(await Session.exists({ session_id: 'seed_earlier' })).toBeNull();
    expect(await Session.countDocuments({ session_id: { $in: ['real-visitor', 'not_seed_1'] } })).toBe(2);
    expect(await Event.countDocuments({ session_id: { $in: ['real-visitor', 'not_seed_1'] } })).toBe(2);
    expect(await Event.countDocuments()).toBe(documents.length + 2);
  });
});

describe('isLocalUri', () => {
  it.each([
    'mongodb://localhost:27017/causalfunnel',
    'mongodb://127.0.0.1/causalfunnel',
    'mongodb://[::1]:27017/causalfunnel',
    'mongodb://user:p%40ss@localhost:27017/causalfunnel?authSource=admin',
  ])('accepts %s', (uri) => {
    expect(isLocalUri(uri)).toBe(true);
  });

  it.each([
    'mongodb+srv://user:pass@cluster0.abcde.mongodb.net/causalfunnel',
    'mongodb://db.example.com:27017/causalfunnel',
    'mongodb://localhost.example.com/causalfunnel',
    'mongodb://localhost:27017,db.example.com:27017/causalfunnel?replicaSet=rs0',
    'mongodb://user:pass@db.example.com/localhost',
    'not a uri',
  ])('rejects %s', (uri) => {
    expect(isLocalUri(uri)).toBe(false);
  });
});

describe('ELEMENTS selectors', () => {
  const ORIGIN = 'http://localhost:4000';
  const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
  const HEADER = ['logo', 'nav-home', 'nav-products', 'nav-about', 'cart'];
  // The pages each element is clicked on in the seed.
  const pagesOf = (name) => {
    if (HEADER.includes(name)) return ['home', 'products', 'about'];
    if (/^(img|add)-/.test(name)) return ['products'];
    if (/^(cta-visit-shop|newsletter-)/.test(name)) return ['about'];
    return ['home'];
  };

  it.each(['home', 'products', 'about'])('match what tracker.js records on the %s page', async (page) => {
    const win = new Window({
      url: ORIGIN + PAGES[page],
      settings: {
        enableJavaScriptEvaluation: true,
        suppressInsecureJavaScriptEnvironmentWarning: true,
        fetch: { virtualServers: [{ url: `${ORIGIN}/`, directory: PUBLIC_DIR }] },
      },
    });
    const sent = [];
    win.navigator.sendBeacon = (to, blob) => sent.push(blob) > 0;
    // happy-dom waits for timers; the tracker's batch and dead-click timers aren't needed here.
    win.setTimeout = () => 0;
    win.clearTimeout = () => {};
    win.document.write(readFileSync(`${PUBLIC_DIR}${page === 'home' ? 'demo/index.html' : PAGES[page].slice(1)}`, 'utf8'));
    await win.happyDOM.waitUntilComplete();

    const names = Object.keys(ELEMENTS).filter((name) => pagesOf(name).includes(page));
    for (const name of names) {
      const element = win.document.querySelector(ELEMENTS[name].target.selector);
      expect(element, name).not.toBeNull();
      element.addEventListener('click', (e) => e.preventDefault()); // stay on the page
      element.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    }
    win.__cfTracker.flush();
    const recorded = (await Promise.all(sent.map((blob) => blob.text())))
      .flatMap((body) => JSON.parse(body).events)
      .filter((event) => event.type === 'click');
    // Sorted: clicks on form fields skip the dead-click hold, so they are queued first.
    expect(recorded.map((click) => click.target.selector).sort()).toEqual(names.map((name) => ELEMENTS[name].target.selector).sort());
    await win.happyDOM.close();
  });
});
