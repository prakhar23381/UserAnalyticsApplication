import { describe, expect, it } from 'vitest';
import { engagementMap, normalize, ROW_PX } from './engagement';
import type { EngagementView } from './types';

const view = (scroll_depth: number, bands: number[] = [], overrides: Partial<EngagementView> = {}): EngagementView => ({
  scroll_depth,
  scroll_distance: 0,
  active_ms: 10_000,
  bands,
  viewport_w: 1280,
  viewport_h: 800,
  doc_w: 1280,
  doc_h: 2000,
  device: 'desktop',
  ...overrides,
});

describe('engagementMap', () => {
  it('gives each 50 px row the share of views that reached it', () => {
    const map = engagementMap([view(800), view(1200), view(2000), view(2000)], 'desktop');
    expect(map.height).toBe(2000);
    expect(map.reach).toHaveLength(40);
    expect(map.reach[0]).toBe(1); // everyone sees the first screen
    expect(map.reach[1000 / ROW_PX]).toBe(0.75); // 1000–1050: three of four
    expect(map.reach[39]).toBe(0.5);
    expect(map.half).toBe(2000);
    expect(map.fold).toBe(800);
  });

  it('averages attention per row over all views, and sums up the visit', () => {
    const map = engagementMap([view(900, [4000, 2000]), view(900, [0, 2000], { active_ms: 2000, scroll_depth: 1000 })], 'desktop');
    expect(map.attention.slice(0, 3)).toEqual([2000, 2000, 0]);
    expect(map.avgActiveMs).toBe(6000);
    expect(map.avgDepth).toBe(0.475); // (900 + 1000) / 2000 / 2
  });

  it('maps phone depths and bands to the page height at the reference width', () => {
    // 375 wide: the page is 4000 tall there; a 390 window saw a 3600 tall page.
    const phone = { device: 'mobile' as const, viewport_h: 800 };
    const map = engagementMap(
      [
        view(4000, [], { ...phone, viewport_w: 375, doc_w: 375, doc_h: 4000 }),
        view(1800, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 900], { ...phone, viewport_w: 390, doc_w: 390, doc_h: 3600 }),
      ],
      'mobile',
    );
    expect(map.height).toBe(4000);
    expect(map.reach[1950 / ROW_PX]).toBe(1); // 1800 × 4000/3600 = 2000
    expect(map.reach[2050 / ROW_PX]).toBe(0.5);
    // band 35 (1750–1800) × 10/9 → its middle lands at 1972 px: row 39
    expect(map.attention[39]).toBe(450);
  });

  it('is empty without views', () => {
    expect(engagementMap([], 'desktop')).toMatchObject({ height: 0, reach: [], attention: [], half: null, views: 0, avgActiveMs: 0 });
  });
});

describe('normalize', () => {
  it('scales to the largest value', () => {
    expect(normalize([0, 2, 4])).toEqual([0, 0.5, 1]);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });
});
