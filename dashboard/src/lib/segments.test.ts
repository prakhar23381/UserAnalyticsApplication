import { describe, expect, it } from 'vitest';
import { readFilters } from './filters';
import {
  addSegment,
  applySegment,
  isWatched,
  liveWatchItems,
  matchSegment,
  parseDefaultSegment,
  parseSegments,
  parseWatchlist,
  removeSegment,
  renameProblem,
  renameSegment,
  type SavedSegment,
  saveProblem,
  segmentQuery,
  toggleWatch,
} from './segments';

const filtersOf = (query: string) => readFilters(new URLSearchParams(query));
const phones: SavedSegment = { id: 'a', name: 'Phones from Google', query: 'devices=mobile&referrers=google.com' };

describe('segmentQuery', () => {
  it('keeps the filters in a fixed order and leaves out the date range and other state', () => {
    expect(segmentQuery(filtersOf('tab=sessions&range=7d&referrers=google.com&devices=mobile&p=3'))).toBe(
      'devices=mobile&referrers=google.com',
    );
    expect(segmentQuery(filtersOf('range=7d'))).toBe('');
  });
});

describe('applySegment and matchSegment', () => {
  it('replaces every filter but the date range, and resets the list page', () => {
    const changes = applySegment(phones.query);
    expect(changes).toMatchObject({ devices: 'mobile', referrers: 'google.com', browsers: null, min_clicks: null, p: null });
    expect('range' in changes).toBe(false);
  });

  it('drops parameters a stored query should not carry', () => {
    expect(applySegment('browsers=Chrome&min_clicks=-4&tab=heatmaps')).toMatchObject({ browsers: 'Chrome', min_clicks: null });
    expect('tab' in applySegment('tab=heatmaps')).toBe(false);
  });

  it('finds the saved segment the current filters are, whatever the order or date range', () => {
    expect(matchSegment([phones], filtersOf('range=all&referrers=google.com&devices=mobile'))).toBe(phones);
    expect(matchSegment([phones], filtersOf('devices=mobile'))).toBeUndefined();
  });
});

describe('saving and renaming', () => {
  it('explains what stops a save', () => {
    expect(saveProblem([phones], 'Anything', '')).toMatch(/Add a filter first/);
    expect(saveProblem([phones], '  ', 'os=iOS')).toBe('Give the segment a name.');
    expect(saveProblem([phones], 'x'.repeat(41), 'os=iOS')).toMatch(/under 41/);
    expect(saveProblem([phones], 'phones from google', 'os=iOS')).toMatch(/already a segment called/);
    expect(saveProblem([phones], 'Other name', phones.query)).toBe('These filters are already saved as "Phones from Google".');
    expect(saveProblem([phones], 'iPhones', 'os=iOS')).toBeNull();
  });

  it('adds, renames and removes', () => {
    const two = addSegment([phones], { id: 'b', name: '  iPhones ', query: 'os=iOS' });
    expect(two.map((s) => s.name)).toEqual(['Phones from Google', 'iPhones']);
    expect(renameSegment(two, 'b', ' Apple phones ')[1].name).toBe('Apple phones');
    expect(renameProblem(two, 'b', 'Phones from google')).toMatch(/already a segment called/);
    expect(renameProblem(two, 'b', 'iphones')).toBeNull(); // its own name, other case
    expect(removeSegment(two, 'a').map((s) => s.id)).toEqual(['b']);
  });
});

describe('watchlist', () => {
  const page = { kind: 'page', page_url: 'http://x.test/about' } as const;
  const segment = { kind: 'segment', id: 'a' } as const;

  it('toggles items in and out', () => {
    const one = toggleWatch([], page);
    expect(one).toEqual([page]);
    expect(isWatched(one, { kind: 'page', page_url: 'http://x.test/about' })).toBe(true);
    expect(toggleWatch(toggleWatch(one, segment), page)).toEqual([segment]);
  });

  it('forgets segments that were deleted', () => {
    expect(liveWatchItems([segment, page, { kind: 'segment', id: 'gone' }], [phones])).toEqual([segment, page]);
  });
});

describe('reading storage', () => {
  it('keeps only well-formed segments, with cleaned queries', () => {
    const raw = JSON.stringify([
      phones,
      { id: 'b', name: 'Bad query', query: 'min_clicks=lots' },
      { id: 'a', name: 'Duplicate id', query: 'os=iOS' },
      { id: 'c', name: 'Messy', query: 'tab=x&os=iOS&range=7d' },
      { name: 'No id', query: 'os=iOS' },
      'nonsense',
    ]);
    expect(parseSegments(raw)).toEqual([phones, { id: 'c', name: 'Messy', query: 'os=iOS' }]);
    expect(parseSegments('{not json')).toEqual([]);
    expect(parseSegments(null)).toEqual([]);
  });

  it('reads the default and the watchlist defensively', () => {
    expect(parseDefaultSegment('"a"')).toBe('a');
    expect(parseDefaultSegment('42')).toBeNull();
    expect(
      parseWatchlist(
        JSON.stringify([{ kind: 'page', page_url: 'http://x.test/' }, { kind: 'page', page_url: 'not a url' }, { kind: 'segment', id: 'a' }, { kind: 'segment', id: 'a' }]),
      ),
    ).toEqual([
      { kind: 'page', page_url: 'http://x.test/' },
      { kind: 'segment', id: 'a' },
    ]);
  });
});
