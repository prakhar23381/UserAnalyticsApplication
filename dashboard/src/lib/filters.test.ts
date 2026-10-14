import { describe, expect, it } from 'vitest';
import {
  apiFilterParams,
  apiFilterQuery,
  devicesParam,
  parseDevices,
  parseRange,
  rangeParam,
  readFilters,
  toggleDevice,
} from './filters';

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
  it('reads both filters from the query string', () => {
    expect(readFilters(new URLSearchParams('range=7d&devices=mobile&tab=sessions'))).toEqual({
      range: '7d',
      devices: ['mobile'],
    });
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
    expect(apiFilterParams({ range: '24h', devices: ['desktop', 'tablet', 'mobile'] }, now)).toEqual({
      from: '2026-10-14T10:05:00.000Z',
    });
    expect(apiFilterParams({ range: '7d', devices: ['mobile'] }, now)).toEqual({
      from: '2026-10-08T10:05:00.000Z',
      devices: 'mobile',
    });
  });

  it('keeps the same `from` within a 5-minute window, so polling reuses the URL', () => {
    const filters = { range: '30d' as const, devices: ['desktop' as const] };
    expect(apiFilterParams(filters, now)).toEqual(apiFilterParams(filters, now + 2 * 60 * 1000));
  });

  it('sends no range for all time', () => {
    expect(apiFilterParams({ range: 'all', devices: ['desktop', 'tablet', 'mobile'] }, now)).toEqual({});
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
