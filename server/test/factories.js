import { rebuildSessions } from '../src/lib/sessionStore.js';
import { Event } from '../src/models/Event.js';

export const BASE_TIME = Date.parse('2026-10-12T10:00:00.000Z');
export const HOME = 'http://localhost:4000/demo';
export const PRODUCTS = 'http://localhost:4000/demo/products.html';

/** ISO time `seconds` after BASE_TIME, as the API returns it. */
export const iso = (seconds) => new Date(BASE_TIME + seconds * 1000).toISOString();

/** A stored event, shaped as validateEvent would shape it. `at` is seconds after BASE_TIME. */
export function eventDoc({ at = 0, page_url = HOME, ...overrides } = {}) {
  return {
    session_id: 's_1',
    type: 'page_view',
    page_url,
    raw_url: page_url,
    timestamp: new Date(BASE_TIME + at * 1000),
    viewport_w: 1440,
    viewport_h: 900,
    doc_w: 1440,
    doc_h: 2400,
    device: 'desktop',
    ...overrides,
  };
}

export const clickDoc = (overrides = {}) => eventDoc({ type: 'click', x: 100, y: 200, ...overrides });

/** Stores events and builds their sessions, as POST /api/events does. */
export async function insert(...docs) {
  const stored = await Event.insertMany(docs.flat());
  await rebuildSessions(stored.map((doc) => doc.session_id));
  return stored;
}
