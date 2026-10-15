import { EVENT_TYPES } from '../models/Event.js';
import { deviceFor } from './device.js';
import { normalizeUrl } from './normalizeUrl.js';

export const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_URL_LENGTH = 2048;
// Larger than any real page; stops one bad event from stretching a heatmap.
const MAX_PX = 100_000;
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;
const TARGET_LIMITS = { tag: 32, id: 128, classes: 256, text: 80 };
const MAX_SELECTOR = 256; // a cut-off selector would name the wrong element, so a longer one is dropped
const BOX_FIELDS = ['x', 'y', 'w', 'h'];
const MAX_BANDS = 400;
const MAX_ACTIVE_MS = 24 * 60 * 60 * 1000;
const MAX_SCROLL_DISTANCE = 10_000_000;

const isCount = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
const SIZE_FIELDS = ['viewport_w', 'viewport_h', 'doc_w', 'doc_h'];

const fail = (error) => ({ ok: false, error });

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isPx = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_PX;

function cleanTarget(target) {
  if (!isObject(target)) return undefined;
  const clean = {};
  for (const [key, max] of Object.entries(TARGET_LIMITS)) {
    const value = target[key];
    if (typeof value === 'string' && value.trim()) clean[key] = value.trim().slice(0, max);
  }
  const selector = typeof target.selector === 'string' ? target.selector.trim() : '';
  if (selector && selector.length <= MAX_SELECTOR) clean.selector = selector;
  // The element's box in page px; left out unless every side is a sane number.
  if (isObject(target.box) && BOX_FIELDS.every((key) => isPx(target.box[key]))) {
    clean.box = Object.fromEntries(BOX_FIELDS.map((key) => [key, Math.round(target.box[key])]));
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

/**
 * Checks one event from the tracker and shapes it for storage: unknown fields
 * are dropped, strings truncated, `page_url` normalized (the original is kept
 * in `raw_url`) and `device` derived from the viewport.
 *
 * Returns `{ ok: true, value }` or `{ ok: false, error }`.
 */
export function validateEvent(input) {
  if (!isObject(input)) return fail('event must be an object');
  const { session_id, type, page_url, timestamp } = input;

  if (!EVENT_TYPES.includes(type)) {
    return fail(`type must be one of: ${EVENT_TYPES.join(', ')}`);
  }
  if (typeof session_id !== 'string' || !SESSION_ID_RE.test(session_id)) {
    return fail('session_id must be 1-64 characters of A-Z, a-z, 0-9, _ or -');
  }

  if (typeof page_url !== 'string' || page_url.length > MAX_URL_LENGTH) {
    return fail(`page_url must be a URL of at most ${MAX_URL_LENGTH} characters`);
  }
  let url;
  try {
    url = new URL(page_url);
  } catch {
    return fail('page_url must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return fail('page_url must be an http(s) URL');
  }

  const time = new Date(typeof timestamp === 'string' ? timestamp : NaN);
  if (Number.isNaN(time.getTime())) return fail('timestamp must be an ISO 8601 date string');
  if (time.getTime() > Date.now() + MAX_FUTURE_MS) {
    return fail('timestamp is more than 24h in the future');
  }

  for (const key of SIZE_FIELDS) {
    if (!isPx(input[key])) return fail(`${key} must be a number from 0 to ${MAX_PX}`);
  }

  const value = {
    session_id,
    type,
    page_url: normalizeUrl(page_url),
    raw_url: page_url,
    timestamp: time,
    viewport_w: input.viewport_w,
    viewport_h: input.viewport_h,
    doc_w: input.doc_w,
    doc_h: input.doc_h,
    device: deviceFor(input.viewport_w),
  };
  if (typeof input.referrer === 'string' && input.referrer) {
    value.referrer = input.referrer.slice(0, MAX_URL_LENGTH);
  }
  if (input.pv_id !== undefined) {
    if (typeof input.pv_id !== 'string' || !SESSION_ID_RE.test(input.pv_id)) {
      return fail('pv_id must be 1-64 characters of A-Z, a-z, 0-9, _ or -');
    }
    value.pv_id = input.pv_id;
  }

  if (type === 'page_exit') {
    if (value.pv_id === undefined) return fail('page_exit needs a pv_id');
    if (!isPx(input.scroll_depth)) return fail(`page_exit needs scroll_depth from 0 to ${MAX_PX}`);
    if (!isCount(input.scroll_distance, MAX_SCROLL_DISTANCE)) return fail('page_exit needs scroll_distance as a whole number of px');
    if (!isCount(input.active_ms, MAX_ACTIVE_MS)) return fail('page_exit needs active_ms as whole milliseconds, at most 24 h');
    if (!Array.isArray(input.bands) || input.bands.length > MAX_BANDS || !input.bands.every((ms) => isCount(ms, MAX_ACTIVE_MS))) {
      return fail(`page_exit needs bands: at most ${MAX_BANDS} whole milliseconds`);
    }
    Object.assign(value, {
      scroll_depth: Math.round(input.scroll_depth),
      scroll_distance: input.scroll_distance,
      active_ms: input.active_ms,
      bands: input.bands,
    });
  }

  if (type === 'click') {
    if (!isPx(input.x) || !isPx(input.y)) {
      return fail(`click needs x and y from 0 to ${MAX_PX}`);
    }
    value.x = input.x;
    value.y = input.y;
    const target = cleanTarget(input.target);
    if (target) value.target = target;
    if (input.dead !== undefined && typeof input.dead !== 'boolean') return fail('dead must be true or false');
    if (input.dead === true) value.dead = true;
  }

  return { ok: true, value };
}
