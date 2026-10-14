import { describe, expect, it } from 'vitest';
import {
  activeFilters,
  apiFilterParams,
  apiFilterQuery,
  clearAllFilters,
  clearFilter,
  countryName,
  devicesParam,
  FILTER_DEFS,
  type FilterDef,
  type Filters,
  filterSummary,
  isNarrowed,
  optionLabel,
  parseDevices,
  parseRange,
  rangeParam,
  readFilters,
  toggleDevice,
  toggleListValue,
} from './filters';

const ALL = ['desktop', 'tablet', 'mobile'] as const;
const filters = (overrides: Partial<Filters> = {}): Filters => ({ range: '30d', devices: [...ALL], params: {}, ...overrides });
const def = (id: string): FilterDef => FILTER_DEFS.find((d) => d.id === id)!;

describe('parseRange and rangeParam', () => {
  it('reads a known preset and falls back to the last 30 days', () => {
    expect(parseRange('7d')).toBe('7d');
    expect(parseRange('all')).toBe('all');
    expect(parseRange(null)).toBe('30d');
    expect(parseRange('5y')).toBe('30d');
  });

  it('leaves the default out of the URL', () => {
    expect(rangeParam('30d')).toBeNull();
    expect(rangeParam('7d')).toBe('7d');
  });
});

describe('parseDevices and devicesParam', () => {
  it('reads known devices in a fixed order', () => {
    expect(parseDevices('mobile,desktop')).toEqual(['desktop', 'mobile']);
    expect(parseDevices('tablet,watch')).toEqual(['tablet']);
  });

  it('means every device when missing, empty or unknown', () => {
    const all = ['desktop', 'tablet', 'mobile'];
    expect(parseDevices(null)).toEqual(all);
    expect(parseDevices('')).toEqual(all);
    expect(parseDevices('watch')).toEqual(all);
  });

  it('writes nothing when every device is selected', () => {
    expect(devicesParam(['desktop', 'tablet', 'mobile'])).toBeNull();
    expect(devicesParam(['mobile', 'desktop'])).toBe('desktop,mobile');
  });
});

describe('readFilters', () => {
  it('reads the date range, devices and other filters from the query string', () => {
    expect(readFilters(new URLSearchParams('range=7d&devices=mobile&tab=sessions'))).toEqual({
      range: '7d',
      devices: ['mobile'],
      params: {},
    });
    const query = 'browsers=Chrome,,Safari,Chrome&utm_campaign=Spring%2C%20sale&min_duration=030&visited_page=http://x.test/a';
    expect(readFilters(new URLSearchParams(query)).params).toEqual({
      browsers: 'Chrome,Safari',
      utm_campaign: 'Spring, sale',
      min_duration: '30',
      visited_page: 'http://x.test/a',
    });
  });

  it('drops values that can never match', () => {
    const query = 'browsers=,&min_clicks=-1&max_pages=two&entry_page=about&utm_source=%20';
    expect(readFilters(new URLSearchParams(query)).params).toEqual({});
  });
});

describe('toggleDevice', () => {
  it('adds and removes devices, keeping the fixed order', () => {
    expect(toggleDevice(['desktop', 'tablet', 'mobile'], 'tablet')).toEqual(['desktop', 'mobile']);
    expect(toggleDevice(['mobile'], 'desktop')).toEqual(['desktop', 'mobile']);
  });

  it('never removes the last device', () => {
    expect(toggleDevice(['mobile'], 'mobile')).toEqual(['mobile']);
  });
});

describe('apiFilterParams', () => {
  const now = Date.parse('2026-10-15T10:07:30.000Z');

  it('starts the range at now minus the preset, rounded down to 5 minutes', () => {
    expect(apiFilterParams(filters({ range: '24h' }), now)).toEqual({
      from: '2026-10-14T10:05:00.000Z',
    });
    expect(apiFilterParams(filters({ range: '7d', devices: ['mobile'] }), now)).toEqual({
      from: '2026-10-08T10:05:00.000Z',
      devices: 'mobile',
    });
  });

  it('keeps the same `from` within a 5-minute window, so polling reuses the URL', () => {
    const desktop = filters({ devices: ['desktop'] });
    expect(apiFilterParams(desktop, now)).toEqual(apiFilterParams(desktop, now + 2 * 60 * 1000));
  });

  it('sends no range for all time', () => {
    expect(apiFilterParams(filters({ range: 'all' }), now)).toEqual({});
  });

  it('passes the other filters through under their own names', () => {
    expect(apiFilterParams(filters({ range: 'all', params: { countries: 'IN,unknown', max_clicks: '3' } }), now)).toEqual({
      countries: 'IN,unknown',
      max_clicks: '3',
    });
  });
});

describe('apiFilterQuery', () => {
  it('appends the set parameters, or nothing', () => {
    expect(apiFilterQuery({ from: '2026-10-08T10:05:00.000Z', devices: 'mobile' })).toBe(
      '&from=2026-10-08T10%3A05%3A00.000Z&devices=mobile',
    );
    expect(apiFilterQuery({ from: '2026-10-08T10:05:00.000Z', devices: 'mobile' }, ['from'])).toBe(
      '&from=2026-10-08T10%3A05%3A00.000Z',
    );
    expect(apiFilterQuery({})).toBe('');
  });
});

describe('list filters', () => {
  it('adds and removes one value, clearing the filter with the last one', () => {
    const chrome = filters({ params: { browsers: 'Chrome' } });
    expect(toggleListValue(chrome, 'browsers', 'Safari')).toBe('Chrome,Safari');
    expect(toggleListValue(chrome, 'browsers', 'Chrome')).toBeNull();
    expect(toggleListValue(filters(), 'os', 'iOS')).toBe('iOS');
  });
});

describe('activeFilters, isNarrowed and clearing', () => {
  it('lists the set filters in menu order', () => {
    const set = filters({ params: { max_duration: '60', countries: 'IN', utm_source: 'ad' } });
    expect(activeFilters(set).map((d) => d.id)).toEqual(['countries', 'utm_source', 'duration']);
  });

  it('knows when the segment is narrower than everything', () => {
    expect(isNarrowed(filters({ range: 'all' }))).toBe(false);
    expect(isNarrowed(filters())).toBe(true);
    expect(isNarrowed(filters({ range: 'all', devices: ['tablet'] }))).toBe(true);
    expect(isNarrowed(filters({ range: 'all', params: { os: 'iOS' } }))).toBe(true);
  });

  it('clears one filter (both ends of a range) or all of them, but never the date range', () => {
    expect(clearFilter(def('duration'))).toEqual({ min_duration: null, max_duration: null });
    expect(clearFilter(def('browsers'))).toEqual({ browsers: null });
    const all = clearAllFilters();
    expect(all).toMatchObject({ devices: null, browsers: null, visited_page: null, max_clicks: null });
    expect('range' in all).toBe(false);
  });
});

describe('labels', () => {
  it('names countries, direct visits and pages', () => {
    expect(countryName('IN')).toBe('India');
    expect(countryName('unknown')).toBe('Unknown');
    expect(optionLabel('referrers', 'direct')).toBe('Direct (no referrer)');
    expect(optionLabel('referrers', 'google.com')).toBe('google.com');
    expect(optionLabel('exit_pages', 'http://localhost:4000/demo/about.html')).toBe('/demo/about.html');
  });

  it('summarises a filter for its chip', () => {
    const set = filters({
      params: { countries: 'IN,unknown', entry_page: 'http://x.test/shop', min_duration: '10', max_duration: '120', min_clicks: '3', max_pages: '1' },
    });
    expect(filterSummary(def('countries'), set)).toBe('India, Unknown');
    expect(filterSummary(def('entry_page'), set)).toBe('/shop');
    expect(filterSummary(def('duration'), set)).toBe('10s – 2m 00s');
    expect(filterSummary(def('clicks'), set)).toBe('≥ 3');
    expect(filterSummary(def('pages'), set)).toBe('≤ 1');
  });

  it('names insights, joined with "and" since a session needs all of them', () => {
    expect(optionLabel('insights', 'quick_back')).toBe('Quick backs');
    const set = filters({ params: { insights: 'rage,dead' } });
    expect(filterSummary(def('insights'), set)).toBe('Rage clicks and Dead clicks');
    expect(readFilters(new URLSearchParams('insights=rage,%20dead,rage')).params.insights).toBe('rage,dead');
  });
});
