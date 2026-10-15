import { describe, expect, it } from 'vitest';
import { parseFilters, rangeCondition, sessionMatch } from '../src/lib/filters.js';

describe('parseFilters', () => {
  it('accepts no filters at all', () => {
    expect(parseFilters({})).toEqual({ ok: true, filters: {} });
  });

  it('parses every kind of parameter, keeping only the ones given', () => {
    const result = parseFilters({
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-08T00:00:00Z',
      devices: 'mobile, tablet,mobile',
      browsers: 'Chrome,Samsung Internet',
      os: 'iOS',
      countries: 'in,unknown',
      referrers: 'www.Google.com,direct',
      utm_campaign: ' spring, sale ',
      entry_page: 'http://localhost:4000/demo/index.html?utm_source=x',
      min_duration: '30',
      max_pages: '4',
      insights: 'dead, rage,dead',
    });
    expect(result).toEqual({
      ok: true,
      filters: {
        from: new Date('2026-10-01T00:00:00Z'),
        to: new Date('2026-10-08T00:00:00Z'),
        devices: ['mobile', 'tablet'],
        browsers: ['Chrome', 'Samsung Internet'],
        os: ['iOS'],
        countries: ['IN', 'unknown'],
        referrers: ['google.com', 'direct'],
        utm_campaign: 'spring, sale',
        entry_page: 'http://localhost:4000/demo',
        min_duration: 30,
        max_pages: 4,
        insights: ['dead', 'rage'],
      },
    });
  });

  it.each([
    [{ from: 'yesterday' }, 'from must be an ISO 8601 date'],
    [{ to: ['2026-10-01', '2026-10-02'] }, 'to must be given once'],
    [{ from: '2026-10-08', to: '2026-10-01' }, 'from must be before to'],
    [{ from: '2026-10-08', to: '2026-10-08' }, 'from must be before to'],
    [{ devices: 'watch' }, 'devices must be a comma-separated list of: mobile, tablet, desktop'],
    [{ devices: ',' }, 'devices must be a comma-separated list of: mobile, tablet, desktop'],
    [{ devices: ['mobile', 'tablet'] }, 'devices must be given once'],
    [{ browsers: 'Netscape' }, expect.stringContaining('browsers must be a comma-separated list of: Edge')],
    [{ countries: 'India' }, 'countries must be a comma-separated list of: two-letter country codes or unknown'],
    [{ referrers: 'evil.com/path' }, 'referrers must be a comma-separated list of: site hosts or direct'],
    [{ utm_source: '  ' }, 'utm_source must be 1-100 characters'],
    [{ visited_page: 'products' }, 'visited_page must be a page URL'],
    [{ min_clicks: '-1' }, 'min_clicks must be a whole number'],
    [{ max_duration: '1.5' }, 'max_duration must be a whole number'],
    [{ min_pages: '5', max_pages: '2' }, 'min_pages must not be more than max_pages'],
    [{ insights: 'rage,bored' }, 'insights must be a comma-separated list of: rage, dead, quick_back, excessive_scroll'],
  ])('rejects %j', (query, error) => {
    expect(parseFilters(query)).toEqual({ ok: false, error });
  });
});

describe('rangeCondition', () => {
  const from = new Date('2026-10-01T00:00:00Z');
  const to = new Date('2026-10-08T00:00:00Z');

  it('builds a half-open range, or nothing for "any time"', () => {
    expect(rangeCondition({ from, to })).toEqual({ $gte: from, $lt: to });
    expect(rangeCondition({ from })).toEqual({ $gte: from });
    expect(rangeCondition({})).toBeUndefined();
  });
});

describe('sessionMatch', () => {
  const from = new Date('2026-10-01T00:00:00Z');

  it('is empty for no filters', () => {
    expect(sessionMatch({})).toEqual({});
  });

  it('turns each filter into a condition on the session document', () => {
    const { filters } = parseFilters({
      from: from.toISOString(),
      devices: 'mobile',
      countries: 'IN,unknown',
      referrers: 'direct',
      utm_source: 'newsletter',
      visited_page: 'http://localhost:4000/demo/about.html',
      exit_page: 'http://localhost:4000/demo/',
      min_duration: '30',
      max_duration: '600',
      min_clicks: '1',
      insights: 'rage,quick_back',
    });
    expect(sessionMatch(filters)).toEqual({
      first_seen: { $gte: from },
      device: { $in: ['mobile'] },
      country: { $in: ['IN', null] },
      referrer: { $in: [null] },
      utm_source: 'newsletter',
      pages: 'http://localhost:4000/demo/about.html',
      exit_page: 'http://localhost:4000/demo',
      duration_ms: { $gte: 30_000, $lte: 600_000 },
      clicks: { $gte: 1 },
      rage_clicks: { $gt: 0 },
      quick_backs: { $gt: 0 },
    });
  });

  it('can leave the date range to the caller', () => {
    expect(sessionMatch({ from, devices: ['tablet'] }, { range: false })).toEqual({ device: { $in: ['tablet'] } });
  });
});
