import { describe, expect, it } from 'vitest';
import { dashboardHref, legacyHref, parsePageNumber, parseTab } from './url';

describe('parseTab', () => {
  it('reads a known tab and falls back to overview', () => {
    expect(parseTab('sessions')).toBe('sessions');
    expect(parseTab('heatmaps')).toBe('heatmaps');
    expect(parseTab(null)).toBe('overview');
    expect(parseTab('settings')).toBe('overview');
  });
});

describe('parsePageNumber', () => {
  it('reads a positive integer and falls back to 1', () => {
    expect(parsePageNumber('3')).toBe(3);
    expect(parsePageNumber(null)).toBe(1);
    expect(parsePageNumber('0')).toBe(1);
    expect(parsePageNumber('-2')).toBe(1);
    expect(parsePageNumber('abc')).toBe(1);
  });
});

describe('dashboardHref', () => {
  it('sets and removes parameters, keeping the rest', () => {
    expect(dashboardHref('tab=heatmaps&mode=grid', { device: 'mobile' })).toBe('/?tab=heatmaps&mode=grid&device=mobile');
    expect(dashboardHref('tab=heatmaps&mode=grid', { mode: null })).toBe('/?tab=heatmaps');
    expect(dashboardHref('tab=sessions&p=2', { p: undefined })).toBe('/?tab=sessions');
  });

  it('leaves the default tab out of the URL', () => {
    expect(dashboardHref('tab=sessions', { tab: 'overview' })).toBe('/');
    expect(dashboardHref('', {})).toBe('/');
  });

  it('closes an open journey when the tab changes, but not otherwise', () => {
    expect(dashboardHref('tab=sessions&session=abc&theme=dark', { tab: 'heatmaps' })).toBe('/?tab=heatmaps&theme=dark');
    expect(dashboardHref('tab=sessions&session=abc', { p: 2 })).toBe('/?tab=sessions&session=abc&p=2');
  });

  it('encodes values such as page URLs', () => {
    expect(dashboardHref('', { tab: 'heatmaps', page: 'http://localhost:4000/demo?x=1' })).toBe(
      '/?tab=heatmaps&page=http%3A%2F%2Flocalhost%3A4000%2Fdemo%3Fx%3D1',
    );
  });

  it('accepts URLSearchParams', () => {
    expect(dashboardHref(new URLSearchParams({ tab: 'sessions' }), { session: 's_1' })).toBe('/?tab=sessions&session=s_1');
  });
});

describe('legacyHref', () => {
  it('maps the old sessions list, keeping the page number', () => {
    expect(legacyHref('/sessions', new URLSearchParams())).toBe('/?tab=sessions');
    expect(legacyHref('/sessions', new URLSearchParams('page=3'))).toBe('/?tab=sessions&p=3');
  });

  it('maps an old journey URL', () => {
    expect(legacyHref('/sessions/seed_abc', new URLSearchParams())).toBe('/?tab=sessions&session=seed_abc');
    expect(legacyHref('/sessions/a%20b', new URLSearchParams())).toBe('/?tab=sessions&session=a+b');
  });

  it('maps the old heatmap URL with its parameters', () => {
    const params = new URLSearchParams({ page: 'http://localhost:4000/demo', device: 'mobile', mode: 'grid' });
    expect(legacyHref('/heatmap', params)).toBe('/?tab=heatmaps&page=http%3A%2F%2Flocalhost%3A4000%2Fdemo&device=mobile&mode=grid');
    expect(legacyHref('/heatmap', new URLSearchParams())).toBe('/?tab=heatmaps');
  });

  it('sends anything else to the overview', () => {
    expect(legacyHref('/nope', new URLSearchParams())).toBe('/');
  });
});
