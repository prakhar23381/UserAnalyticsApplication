import { describe, expect, it } from 'vitest';
import { binPoints, layoutClicks, placeClick, previewUrl } from './heatmap';
import type { Device, HeatmapClick } from './types';

const click = (x: number, y: number, doc_w: number, device: Device = 'desktop', doc_h = 2000): HeatmapClick => ({
  x,
  y,
  doc_w,
  doc_h,
  viewport_w: doc_w,
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

  it('never scales y', () => {
    expect(placeClick(click(640, 2455, 1920), 'desktop').y).toBe(2455);
    expect(placeClick(click(100, 3000, 430, 'mobile'), 'mobile').y).toBe(3000);
  });

  it('takes x as is when no document width was recorded', () => {
    expect(placeClick(click(120, 80, 0), 'desktop')).toEqual({ x: 120, y: 80 });
    expect(placeClick(click(120, 80, 0, 'mobile'), 'mobile')).toEqual({ x: 120, y: 80 });
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
