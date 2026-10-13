import { describe, expect, it } from 'vitest';
import { binPoints, layoutClicks, placeClick, previewUrl, referenceHeight } from './heatmap';
import type { Device, HeatmapClick } from './types';

const click = (
  x: number,
  y: number,
  doc_w: number,
  device: Device = 'desktop',
  doc_h = 2000,
  viewport_h = 800,
): HeatmapClick => ({
  x,
  y,
  doc_w,
  doc_h,
  viewport_w: doc_w,
  viewport_h,
  device,
});

describe('placeClick', () => {
  it('keeps clicks recorded at the reference width where they are', () => {
    expect(placeClick(click(100, 640, 1280), 'desktop')).toEqual({ x: 100, y: 640 });
    expect(placeClick(click(100, 640, 768, 'tablet'), 'tablet')).toEqual({ x: 100, y: 640 });
    expect(placeClick(click(100, 640, 375, 'mobile'), 'mobile')).toEqual({ x: 100, y: 640 });
  });

  it('keeps a desktop click its distance from the page centre', () => {
    // 1440 window minus a 15 px scrollbar: the centred column starts 72.5 px further right than at 1280
    expect(placeClick(click(300, 2455, 1425), 'desktop')).toEqual({ x: 227.5, y: 2455 });
    expect(placeClick(click(1000, 50, 1024), 'desktop')).toEqual({ x: 1128, y: 50 });
  });

  it('keeps a tablet or mobile click its share of the width', () => {
    expect(placeClick(click(500, 900, 1000, 'tablet'), 'tablet')).toEqual({ x: 384, y: 900 });
    expect(placeClick(click(195, 900, 390, 'mobile'), 'mobile')).toEqual({ x: 187.5, y: 900 });
  });

  it('keeps a phone or tablet click its share of the page height', () => {
    expect(placeClick(click(195, 1000, 390, 'mobile', 3000), 'mobile', 3300).y).toBe(1100);
    expect(placeClick(click(400, 900, 820, 'tablet', 1800, 1180), 'tablet', 1500).y).toBe(750);
  });

  it('keeps y as recorded without a reference height', () => {
    expect(placeClick(click(100, 3000, 430, 'mobile'), 'mobile').y).toBe(3000);
  });

  it('keeps y as recorded when the page was no taller than its window', () => {
    // scrollHeight is the window's height then, not the page's
    expect(placeClick(click(100, 500, 820, 'tablet', 1180, 1180), 'tablet', 1024).y).toBe(500);
  });

  it('takes x as is when no document width was recorded', () => {
    expect(placeClick(click(120, 80, 0), 'desktop')).toEqual({ x: 120, y: 80 });
    expect(placeClick(click(120, 80, 0, 'mobile'), 'mobile')).toEqual({ x: 120, y: 80 });
  });
});

describe('referenceHeight', () => {
  it('is null on desktop', () => {
    expect(referenceHeight([click(10, 10, 1280, 'desktop', 2707)], 'desktop')).toBeNull();
  });

  it('is null without a click recorded at the reference width', () => {
    expect(referenceHeight([], 'mobile')).toBeNull();
    expect(referenceHeight([click(10, 10, 390, 'mobile', 3390, 844)], 'mobile')).toBeNull();
  });

  it('skips pages that fit their window', () => {
    // the seeded tablet home page: 1024 tall in a 768×1024 window
    expect(referenceHeight([click(10, 340, 768, 'tablet', 1024, 1024)], 'tablet')).toBeNull();
  });

  it('picks the most common height, not the tallest', () => {
    const clicks = [3452, 3464, 3452].map((h) => click(10, 10, 375, 'mobile', h, 812));
    expect(referenceHeight(clicks, 'mobile')).toBe(3452);
  });

  it('takes the taller height on a tie, whatever the order', () => {
    const heights = [3452, 3464];
    const forward = heights.map((h) => click(10, 10, 375, 'mobile', h, 812));
    expect(referenceHeight(forward, 'mobile')).toBe(3464);
    expect(referenceHeight([...forward].reverse(), 'mobile')).toBe(3464);
  });
});

describe('layoutClicks', () => {
  it('is as tall as the tallest document and as wide as the reference', () => {
    const layout = layoutClicks([click(10, 10, 1280, 'desktop', 920), click(20, 20, 1280, 'desktop', 2707)], 'desktop');
    expect(layout.width).toBe(1280);
    expect(layout.height).toBe(2707);
    expect(layout.points).toHaveLength(2);
  });

  it('grows to fit a click below the recorded document height', () => {
    expect(layoutClicks([click(10, 3100.4, 1280, 'desktop', 3000)], 'desktop').height).toBe(3101);
  });

  it('counts clicks that land off the canvas instead of drawing them', () => {
    // At 1920 the centred column starts 320 px further right, so x = 50 maps to -270
    const layout = layoutClicks([click(50, 10, 1920), click(1900, 10, 1920), click(960, 10, 1920)], 'desktop');
    expect(layout.outside).toBe(2);
    expect(layout.points).toEqual([{ x: 640, y: 10 }]);
  });

  it('is empty without clicks', () => {
    expect(layoutClicks([], 'mobile')).toEqual({ width: 375, height: 0, points: [], outside: 0 });
  });

  it('never scales desktop y', () => {
    // a 1440 window draws the same centred column as 1280, whatever doc_h it reports
    const layout = layoutClicks([click(10, 10, 1280, 'desktop', 2707), click(300, 2455, 1440, 'desktop', 2800)], 'desktop');
    expect(layout.points.map((p) => p.y)).toEqual([10, 2455]);
  });

  it('scales phone y to the page height at 375, and the canvas with it', () => {
    const layout = layoutClicks([click(10, 10, 375, 'mobile', 3464, 812), click(195, 1000, 390, 'mobile', 3390, 844)], 'mobile');
    expect(layout.points[1].y).toBeCloseTo(1021.83, 2);
    expect(layout.height).toBe(3464);
  });

  it('leaves a tablet click as recorded when its page fit the window (iPad Air on the home page)', () => {
    // Seeded at 768×1024, the home page fits its window, so it gives no reference height.
    // An iPad Air (820×1180) reports doc_h 1180; scaling by 1024 / 1180 would put this
    // "Shop" click at y 295, above the button (313–367 at 768).
    const seeded = click(80, 340, 768, 'tablet', 1024, 1024);
    const ipad = click(82, 340, 820, 'tablet', 1180, 1180);
    const layout = layoutClicks([seeded, ipad], 'tablet');
    expect(layout.points[1].y).toBe(340);
  });

  it('puts the e2e phone click on the About CTA (stored values)', () => {
    // From the local e2e run: "Visit the shop" clicked at 390 px, after the newsletter
    // was submitted. At 375 the seed measured the button at [112, 3117, 152, 54].
    const seeded = { x: 196, y: 3149, doc_w: 375, doc_h: 3464, viewport_w: 375, viewport_h: 812, device: 'mobile' } as const;
    const e2e = { x: 200, y: 3094, doc_w: 390, doc_h: 3390, viewport_w: 390, viewport_h: 844, device: 'mobile' } as const;
    const { points } = layoutClicks([seeded, e2e], 'mobile');
    expect(e2e.y).toBeLessThan(3117); // as recorded, the dot sits above the button
    expect(points[1].x).toBeGreaterThanOrEqual(112);
    expect(points[1].x).toBeLessThanOrEqual(112 + 152);
    expect(points[1].y).toBeGreaterThanOrEqual(3117);
    expect(points[1].y).toBeLessThanOrEqual(3117 + 54);
  });
});

describe('previewUrl', () => {
  it('adds cf_preview=1 so the tracker on the page stays quiet', () => {
    expect(previewUrl('http://localhost:4000/demo')).toBe('http://localhost:4000/demo?cf_preview=1');
    expect(previewUrl('https://example.com/demo/products.html')).toBe(
      'https://example.com/demo/products.html?cf_preview=1',
    );
  });

  it('refuses anything that is not an http(s) URL', () => {
    expect(previewUrl('javascript:alert(1)')).toBeNull();
    expect(previewUrl('data:text/html,hi')).toBeNull();
    expect(previewUrl('not a url')).toBeNull();
  });
});

describe('binPoints', () => {
  it('counts points per cell and reports the busiest count', () => {
    const { cells, max } = binPoints([
      { x: 5, y: 5 },
      { x: 39.9, y: 39.9 },
      { x: 40, y: 5 },
    ]);
    expect(max).toBe(2);
    expect(cells).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0, count: 2 },
        { x: 40, y: 0, count: 1 },
      ]),
    );
    expect(cells).toHaveLength(2);
  });

  it('uses the given cell size', () => {
    expect(binPoints([{ x: 25, y: 75 }], 20).cells).toEqual([{ x: 20, y: 60, count: 1 }]);
  });

  it('has no cells and a max of 0 without points', () => {
    expect(binPoints([])).toEqual({ cells: [], max: 0 });
  });
});
