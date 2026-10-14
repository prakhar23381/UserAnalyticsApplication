import { describe, expect, it } from 'vitest';
import { parseFilters, rangeCondition, withFilters } from '../src/lib/filters.js';

describe('parseFilters', () => {
  it('accepts no filters at all', () => {
    expect(parseFilters({})).toEqual({ ok: true, filters: { from: undefined, to: undefined, devices: undefined } });
  });

  it('parses the range and the devices', () => {
    const result = parseFilters({ from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', devices: 'mobile, tablet,mobile' });
    expect(result.ok).toBe(true);
    expect(result.filters.from).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(result.filters.to).toEqual(new Date('2026-10-08T00:00:00Z'));
    expect(result.filters.devices).toEqual(['mobile', 'tablet']);
  });

  it.each([
    [{ from: 'yesterday' }, 'from must be an ISO 8601 date'],
    [{ to: ['2026-10-01', '2026-10-02'] }, 'to must be given once'],
    [{ from: '2026-10-08', to: '2026-10-01' }, 'from must be before to'],
    [{ from: '2026-10-08', to: '2026-10-08' }, 'from must be before to'],
    [{ devices: 'watch' }, 'devices must be a comma-separated list of: mobile, tablet, desktop'],
    [{ devices: ',' }, 'devices must be a comma-separated list of: mobile, tablet, desktop'],
    [{ devices: ['mobile', 'tablet'] }, 'devices must be given once'],
  ])('rejects %j', (query, error) => {
    expect(parseFilters(query)).toEqual({ ok: false, error });
  });
});

describe('rangeCondition and withFilters', () => {
  const from = new Date('2026-10-01T00:00:00Z');
  const to = new Date('2026-10-08T00:00:00Z');

  it('builds a half-open range, or nothing for "any time"', () => {
    expect(rangeCondition({ from, to })).toEqual({ $gte: from, $lt: to });
    expect(rangeCondition({ from })).toEqual({ $gte: from });
    expect(rangeCondition({})).toBeUndefined();
  });

  it('adds only the conditions that are set', () => {
    expect(withFilters({ type: 'click' }, { from, to, devices: ['mobile'] }, { field: 'timestamp', deviceField: 'device' })).toEqual({
      type: 'click',
      timestamp: { $gte: from, $lt: to },
      device: { $in: ['mobile'] },
    });
    expect(withFilters({ type: 'click' }, { devices: ['mobile'] }, { field: 'timestamp' })).toEqual({ type: 'click' });
    expect(withFilters({}, {}, { field: 'timestamp', deviceField: 'device' })).toEqual({});
  });
});
