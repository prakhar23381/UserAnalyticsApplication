import { describe, expect, it } from 'vitest';
import { formatCount, formatDay, formatRate, periodDelta, shares } from './overview';

describe('periodDelta', () => {
  const counts = { kind: 'relative', upIsGood: true } as const;

  it('gives a relative change for counts, good when up', () => {
    expect(periodDelta(120, 100, counts)).toEqual({ text: '+20%', direction: 'up', tone: 'good' });
    expect(periodDelta(95, 100, counts)).toEqual({ text: '−5.0%', direction: 'down', tone: 'bad' });
  });

  it('gives percentage points for rates, and can be bad when up', () => {
    const bounce = { kind: 'points', upIsGood: false } as const;
    expect(periodDelta(0.45, 0.4167, bounce)).toEqual({ text: '+3.3 pp', direction: 'up', tone: 'bad' });
    expect(periodDelta(0.2, 0.4, bounce)).toEqual({ text: '−20 pp', direction: 'down', tone: 'good' });
  });

  it('handles no change, a zero baseline and no previous period', () => {
    expect(periodDelta(5, 5, counts)).toEqual({ text: 'No change', direction: 'flat', tone: 'neutral' });
    expect(periodDelta(7, 0, counts)).toEqual({ text: 'New', direction: 'up', tone: 'good' });
    expect(periodDelta(7, null, counts)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats counts in full below ten thousand, then compactly', () => {
    expect(formatCount(1284)).toBe('1,284');
    expect(formatCount(12_900)).toBe('12.9K');
    expect(formatCount(4_200_000)).toBe('4.2M');
  });

  it('formats rates as a percentage with one decimal', () => {
    expect(formatRate(0.4167)).toBe('41.7%');
    expect(formatRate(0)).toBe('0.0%');
  });

  it('formats UTC days without shifting them into the local zone', () => {
    expect(formatDay('2026-10-08')).toBe('Oct 8');
    expect(formatDay('2026-10-08', true)).toBe('Thu, Oct 8, 2026');
  });
});

describe('shares', () => {
  it('returns whole percentages that add up to 100', () => {
    expect(shares([19, 19, 10])).toEqual([40, 39, 21]); // 39.58, 39.58, 20.83
    expect(shares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});
