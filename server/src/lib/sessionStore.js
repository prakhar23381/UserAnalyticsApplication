import { Event } from '../models/Event.js';
import { Session } from '../models/Session.js';
import { findInsights } from './insights.js';
import { parseUserAgent } from './userAgent.js';

// Keeps the sessions collection in step with the events (M2-D1 in docs/v2-plan.md):
// after events are stored, each of their sessions is recomputed from all its
// events. Ingest, the startup backfill and the seed all go through here, so a
// session always looks the same however its events arrived.

const MAX_PAGES = 200;
const MAX_UTM_LENGTH = 100;
const REBUILD_CHUNK = 500;
const FIELDS = { _id: 0, session_id: 1, type: 1, page_url: 1, raw_url: 1, timestamp: 1, device: 1, referrer: 1, user_agent: 1, country: 1, x: 1, y: 1, dead: 1, pv_id: 1, scroll_distance: 1, doc_h: 1, viewport_h: 1 };

const hostOf = (url) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

/** The landing URL's UTM tags, trimmed; empty ones left out. */
function utmTags(rawUrl) {
  const tags = {};
  let params;
  try {
    params = new URL(rawUrl).searchParams;
  } catch {
    return tags;
  }
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(key)?.trim().slice(0, MAX_UTM_LENGTH);
    if (value) tags[key] = value;
  }
  return tags;
}

/** A session document from its events, oldest first. */
export function summarize(events) {
  const first = events[0];
  const last = events.at(-1);
  const pages = [...new Set(events.map((event) => event.page_url))].slice(0, MAX_PAGES);
  const referrerHost = first.referrer && hostOf(first.referrer);
  const referrer = referrerHost && referrerHost !== hostOf(first.page_url) ? referrerHost : undefined;
  const utm = utmTags(first.raw_url);
  const country = events.find((event) => event.country)?.country;

  return {
    session_id: first.session_id,
    first_seen: first.timestamp,
    last_seen: last.timestamp,
    duration_ms: last.timestamp - first.timestamp, // page exits included: time on the last page counts
    event_count: events.filter((event) => event.type !== 'page_exit').length, // page views and clicks, as the spec counts
    events_seen: events.length, // every event, for the guard in save()
    page_views: events.filter((event) => event.type === 'page_view').length,
    clicks: events.filter((event) => event.type === 'click').length,
    ...findInsights(events).counts,
    pages,
    entry_page: first.page_url,
    exit_page: last.page_url,
    device: first.device,
    ...parseUserAgent(first.user_agent),
    ...(country && { country }),
    ...(referrer && { referrer }),
    ...utm,
    source: utm.utm_source ?? referrer ?? 'Direct',
    updated_at: new Date(),
  };
}

/**
 * Writes a summary unless the stored one was built from more events: two
 * batches of one session can be stored and recomputed at the same time, and
 * the slower recompute may have read fewer events. Events are only ever added,
 * so more events (of any type: `events_seen`) means newer.
 */
async function save(doc) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // A summary from before events_seen existed (v2 M5) is older by definition.
      await Session.replaceOne(
        { session_id: doc.session_id, $or: [{ events_seen: { $lte: doc.events_seen } }, { events_seen: { $exists: false } }] },
        doc,
        { upsert: true },
      );
      return;
    } catch (err) {
      // Duplicate key: a newer summary is stored (the filter missed, so the upsert
      // tried to insert), or another recompute inserted first. Retry once for the latter.
      if (err.code !== 11000) throw err;
    }
  }
}

/** Recomputes these sessions from their events; a session without events is removed. */
export async function rebuildSessions(ids) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;
  const events = await Event.find({ session_id: { $in: unique } }, FIELDS)
    .sort({ session_id: 1, timestamp: 1, _id: 1 }) // the { session_id, timestamp } index
    .lean();

  const bySession = new Map();
  for (const event of events) {
    if (!bySession.has(event.session_id)) bySession.set(event.session_id, []);
    bySession.get(event.session_id).push(event);
  }
  await Promise.all([...bySession.values()].map((sessionEvents) => save(summarize(sessionEvents))));

  const gone = unique.filter((id) => !bySession.has(id));
  if (gone.length > 0) await Session.deleteMany({ session_id: { $in: gone } });
  return bySession.size;
}

/** Recomputes every session, a chunk at a time. Returns how many there are. */
export async function rebuildAllSessions() {
  const ids = await Event.distinct('session_id');
  for (let i = 0; i < ids.length; i += REBUILD_CHUNK) {
    await rebuildSessions(ids.slice(i, i + REBUILD_CHUNK));
  }
  return ids.length;
}

/** At startup: builds the collection once when there are events but no sessions yet (M2-D2). */
export async function ensureSessions() {
  if ((await Session.estimatedDocumentCount()) > 0) return null;
  if ((await Event.estimatedDocumentCount()) === 0) return null;
  return rebuildAllSessions();
}
