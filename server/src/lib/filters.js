import { DEVICES } from '../models/Event.js';

// The dashboard's filter bar, shared by the read endpoints (M1b of docs/v2-plan.md;
// M2 grows this into the full segment parser):
//
//   from, to   ISO 8601 instants; `from` inclusive, `to` exclusive
//   devices    comma-separated subset of desktop,tablet,mobile
//
// Every parameter is optional. Returns { ok: true, filters } or { ok: false, error }.

const MAX_DEVICES_LENGTH = 64;

function parseInstant(name, value) {
  if (value === undefined) return { ok: true };
  if (typeof value !== 'string') return { ok: false, error: `${name} must be given once` };
  const time = Date.parse(value);
  if (Number.isNaN(time)) return { ok: false, error: `${name} must be an ISO 8601 date` };
  return { ok: true, date: new Date(time) };
}

export function parseFilters(query) {
  const from = parseInstant('from', query.from);
  if (!from.ok) return from;
  const to = parseInstant('to', query.to);
  if (!to.ok) return to;
  if (from.date && to.date && from.date >= to.date) {
    return { ok: false, error: 'from must be before to' };
  }

  let devices;
  if (query.devices !== undefined) {
    if (typeof query.devices !== 'string' || query.devices.length > MAX_DEVICES_LENGTH) {
      return { ok: false, error: 'devices must be given once' };
    }
    devices = [...new Set(query.devices.split(',').map((d) => d.trim()).filter(Boolean))];
    if (devices.length === 0 || devices.some((d) => !DEVICES.includes(d))) {
      return { ok: false, error: `devices must be a comma-separated list of: ${DEVICES.join(', ')}` };
    }
  }

  return { ok: true, filters: { from: from.date, to: to.date, devices } };
}

/** A Mongo condition for a date field within the filter's range, or undefined for "any time". */
export function rangeCondition({ from, to }) {
  if (!from && !to) return undefined;
  return { ...(from && { $gte: from }), ...(to && { $lt: to }) };
}

/** Narrows a Mongo match: `field` within the range, `deviceField` among the devices. */
export function withFilters(match, filters, { field, deviceField } = {}) {
  const range = rangeCondition(filters);
  return {
    ...match,
    ...(field && range && { [field]: range }),
    ...(deviceField && filters.devices && { [deviceField]: { $in: filters.devices } }),
  };
}
