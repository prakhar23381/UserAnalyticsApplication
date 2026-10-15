import { DEVICES } from '../models/Event.js';
import { Session } from '../models/Session.js';
import { INSIGHTS } from './insights.js';
import { normalizeUrl } from './normalizeUrl.js';
import { BROWSER_NAMES, OS_NAMES } from './userAgent.js';

// The segment: the dashboard's filter bar, shared by every read endpoint (M2 in
// docs/v2-plan.md). Every parameter is optional; together they are ANDed.
//
//   from, to                    ISO 8601 instants; sessions that started in [from, to)
//   devices, browsers, os       comma-separated lists of known values
//   countries                   comma-separated two-letter codes; `unknown` = none recorded
//   referrers                   comma-separated hosts; `direct` = no other site
//   utm_source/medium/campaign  one exact value each (campaign names may contain commas)
//   entry_page, exit_page,
//   visited_page                one page URL each, normalized like page_url
//   min_/max_duration (seconds), min_/max_pages (page views), min_/max_clicks
//                               whole numbers, inclusive
//   insights                    comma-separated: rage, dead, quick_back, excessive_scroll; a session needs all of them
//
// A segment is a set of sessions: list views read the sessions collection, and
// event views (heatmap, pages) count the events of the matching sessions.

const MAX_LIST_LENGTH = 512;
const MAX_TEXT_LENGTH = 100;
const MAX_NUMBER = 1_000_000_000;

const LISTS = {
  devices: { field: 'device', valid: (v) => DEVICES.includes(v), describe: DEVICES.join(', ') },
  browsers: { field: 'browser', valid: (v) => BROWSER_NAMES.includes(v), describe: BROWSER_NAMES.join(', ') },
  os: { field: 'os', valid: (v) => OS_NAMES.includes(v), describe: OS_NAMES.join(', ') },
  countries: {
    field: 'country',
    none: 'unknown',
    clean: (v) => (v === 'unknown' ? v : v.toUpperCase()),
    valid: (v) => v === 'unknown' || /^[A-Z]{2}$/.test(v),
    describe: 'two-letter country codes or unknown',
  },
  referrers: {
    field: 'referrer',
    none: 'direct',
    clean: (v) => v.toLowerCase().replace(/^www\./, ''),
    valid: (v) => /^[a-z0-9.-]{1,253}$/.test(v),
    describe: 'site hosts or direct',
  },
};
const TEXTS = { utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign' };
const PAGES = { entry_page: 'entry_page', exit_page: 'exit_page', visited_page: 'pages' };
// [min param, max param, session field, factor from the param's unit to the field's]
const NUMBERS = [
  ['min_duration', 'max_duration', 'duration_ms', 1000],
  ['min_pages', 'max_pages', 'page_views', 1],
  ['min_clicks', 'max_clicks', 'clicks', 1],
];
// Each insight's count on the session document (lib/insights.js).
const INSIGHT_FIELDS = { rage: 'rage_clicks', dead: 'dead_clicks', quick_back: 'quick_backs', excessive_scroll: 'excessive_scrolls' };

/** Every query parameter the segment reads. */
export const SEGMENT_PARAMS = [
  'from',
  'to',
  ...Object.keys(LISTS),
  ...Object.keys(TEXTS),
  ...Object.keys(PAGES),
  ...NUMBERS.flatMap(([min, max]) => [min, max]),
  'insights',
];

const fail = (error) => ({ ok: false, error });

function parseInstant(name, value) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return fail(`${name} must be an ISO 8601 date`);
  return { ok: true, value: new Date(time) };
}

function parseList(name, value) {
  const { clean = (v) => v, valid, describe } = LISTS[name];
  if (value.length > MAX_LIST_LENGTH) return fail(`${name} is too long`);
  const items = [...new Set(value.split(',').map((v) => clean(v.trim())).filter(Boolean))];
  if (items.length === 0 || !items.every(valid)) return fail(`${name} must be a comma-separated list of: ${describe}`);
  return { ok: true, value: items };
}

function parseText(name, value) {
  const text = value.trim();
  if (!text || text.length > MAX_TEXT_LENGTH) return fail(`${name} must be 1-${MAX_TEXT_LENGTH} characters`);
  return { ok: true, value: text };
}

function parsePage(name, value) {
  try {
    return { ok: true, value: normalizeUrl(value) };
  } catch {
    return fail(`${name} must be a page URL`);
  }
}

function parseNumber(name, value) {
  if (!/^\d{1,10}$/.test(value) || Number(value) > MAX_NUMBER) return fail(`${name} must be a whole number`);
  return { ok: true, value: Number(value) };
}

function parseInsights(name, value) {
  if (value.length > MAX_LIST_LENGTH) return fail(`${name} is too long`);
  const items = [...new Set(value.split(',').map((v) => v.trim()).filter(Boolean))];
  if (items.length === 0 || !items.every((v) => INSIGHTS.includes(v))) {
    return fail(`${name} must be a comma-separated list of: ${INSIGHTS.join(', ')}`);
  }
  return { ok: true, value: items };
}

const PARSERS = {
  from: parseInstant,
  to: parseInstant,
  ...Object.fromEntries(Object.keys(LISTS).map((name) => [name, parseList])),
  ...Object.fromEntries(Object.keys(TEXTS).map((name) => [name, parseText])),
  ...Object.fromEntries(Object.keys(PAGES).map((name) => [name, parsePage])),
  ...Object.fromEntries(NUMBERS.flatMap(([min, max]) => [[min, parseNumber], [max, parseNumber]])),
  insights: parseInsights,
};

/**
 * Reads the segment from a query object. Returns `{ ok: true, filters }`, with
 * only the parameters that were given, or `{ ok: false, error }`.
 */
export function parseFilters(query) {
  const filters = {};
  for (const name of SEGMENT_PARAMS) {
    const raw = query[name];
    if (raw === undefined) continue;
    // Express 5 turns a repeated parameter into an array.
    if (typeof raw !== 'string') return fail(`${name} must be given once`);
    const parsed = PARSERS[name](name, raw);
    if (!parsed.ok) return parsed;
    filters[name] = parsed.value;
  }
  if (filters.from && filters.to && filters.from >= filters.to) return fail('from must be before to');
  for (const [min, max] of NUMBERS) {
    if (filters[min] !== undefined && filters[max] !== undefined && filters[min] > filters[max]) {
      return fail(`${min} must not be more than ${max}`);
    }
  }
  return { ok: true, filters };
}

/** A Mongo condition for a date field within the range, or undefined for "any time". */
export function rangeCondition({ from, to }) {
  if (!from && !to) return undefined;
  return { ...(from && { $gte: from }), ...(to && { $lt: to }) };
}

/**
 * The segment as a query on the sessions collection. With `range: false`, the
 * date range is left out (the caller sets `first_seen` itself).
 */
export function sessionMatch(filters, { range = true } = {}) {
  const match = {};
  const dates = range && rangeCondition(filters);
  if (dates) match.first_seen = dates;

  for (const [name, { field, none }] of Object.entries(LISTS)) {
    const items = filters[name];
    if (!items) continue;
    // $in with null also matches sessions without the field: `unknown`, `direct`.
    match[field] = { $in: items.map((item) => (item === none ? null : item)) };
  }
  for (const [name, field] of Object.entries({ ...TEXTS, ...PAGES })) {
    if (filters[name] !== undefined) match[field] = filters[name];
  }
  for (const [min, max, field, factor] of NUMBERS) {
    if (filters[min] !== undefined) match[field] = { ...match[field], $gte: filters[min] * factor };
    if (filters[max] !== undefined) match[field] = { ...match[field], $lte: filters[max] * factor };
  }
  for (const insight of filters.insights ?? []) match[INSIGHT_FIELDS[insight]] = { $gt: 0 };
  return match;
}

/**
 * The events of the segment's sessions, as a condition on `session_id`, or {}
 * when the segment is everything. Used by the views built from events (M2-D3).
 */
export async function eventMatch(filters) {
  const match = sessionMatch(filters);
  if (Object.keys(match).length === 0) return {};
  return { session_id: { $in: await Session.distinct('session_id', match) } };
}
