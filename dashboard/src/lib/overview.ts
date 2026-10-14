// Number formatting and period-over-period change for the Overview stat tiles.

export interface Delta {
  text: string; // "+12%", "−3.1 pp", "New", "No change"
  direction: 'up' | 'down' | 'flat';
  tone: 'good' | 'bad' | 'neutral';
}

/**
 * The change from the previous period. Counts and averages change by a
 * relative %, rates (0–1) by percentage points. Null when there's no previous
 * period to compare with ("all time").
 */
export function periodDelta(
  current: number,
  previous: number | null | undefined,
  { kind, upIsGood }: { kind: 'relative' | 'points'; upIsGood: boolean },
): Delta | null {
  if (previous === null || previous === undefined) return null;
  if (current === previous) return { text: 'No change', direction: 'flat', tone: 'neutral' };
  const direction = current > previous ? 'up' : 'down';
  const tone = (direction === 'up') === upIsGood ? 'good' : 'bad';
  const sign = direction === 'up' ? '+' : '−';

  if (kind === 'points') {
    const points = Math.abs(current - previous) * 100;
    return { text: `${sign}${points < 10 ? points.toFixed(1) : Math.round(points)} pp`, direction, tone };
  }
  if (previous === 0) return { text: 'New', direction: 'up', tone: upIsGood ? 'good' : 'bad' };
  const percent = (Math.abs(current - previous) / previous) * 100;
  return { text: `${sign}${percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`, direction, tone };
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** 1,284 below ten thousand, then 12.9K, 4.2M. */
export function formatCount(value: number): string {
  return Math.abs(value) < 10_000 ? value.toLocaleString('en') : compact.format(value);
}

/** 0.4167 → "41.7%". */
export function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** A UTC day ("2026-10-08") as "Oct 8"; with `long`, "Thu, Oct 8, 2026". */
export function formatDay(day: string, long = false): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(long && { weekday: 'short', year: 'numeric' }),
  });
}

/** Each part's share of the whole, as whole percentages that add up to 100 (largest remainder). */
export function shares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * 100);
  const floored = exact.map(Math.floor);
  let left = 100 - floored.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, i) => [value - floored[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floored[i] += 1;
    left -= 1;
  }
  return floored;
}
