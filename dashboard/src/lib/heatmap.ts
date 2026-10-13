import type { Device, HeatmapClick } from './types';

/**
 * Width each device's heatmap is drawn at. The seed script measured its click
 * positions at these widths, so seeded clicks map exactly.
 */
export const REFERENCE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 768, mobile: 375 };

/** Grid mode's cell size, in reference px. */
export const GRID_CELL = 40;

export interface Point {
  x: number;
  y: number;
}

export interface ClickLayout {
  width: number; // the device's reference width
  height: number; // the tallest document among the clicks
  points: Point[]; // clicks that land on the canvas, in reference px
  outside: number; // clicks that fall off its left or right edge
}

export interface Cell {
  x: number; // top-left corner, in reference px
  y: number;
  count: number;
}

/**
 * Where a click lands when its page is drawn at the device's reference width.
 *
 * y stays as recorded (px from the top of the document). x follows how layouts
 * usually respond to width: desktop pages are a centred column, so x keeps its
 * distance from the centre; phone and tablet layouts are fluid, so x keeps its
 * share of the width.
 */
export function placeClick(click: HeatmapClick, device: Device): Point {
  const width = REFERENCE_WIDTH[device];
  if (click.doc_w <= 0) return { x: click.x, y: click.y }; // no width recorded: take it as is
  const x =
    device === 'desktop' ? click.x + (width - click.doc_w) / 2 : (click.x / click.doc_w) * width;
  return { x, y: click.y };
}

export function layoutClicks(clicks: HeatmapClick[], device: Device): ClickLayout {
  const width = REFERENCE_WIDTH[device];
  const points: Point[] = [];
  let height = 0;
  let outside = 0;
  for (const click of clicks) {
    height = Math.max(height, click.doc_h, click.y);
    const point = placeClick(click, device);
    if (point.x < 0 || point.x >= width) outside += 1;
    else points.push(point);
  }
  return { width, height: Math.ceil(height), points, outside };
}

/** Counts points per square cell; `max` is the busiest cell's count. */
export function binPoints(points: Point[], size = GRID_CELL): { cells: Cell[]; max: number } {
  const cells = new Map<string, Cell>();
  for (const { x, y } of points) {
    const col = Math.floor(x / size);
    const row = Math.floor(y / size);
    const key = `${col}:${row}`;
    const cell = cells.get(key);
    if (cell) cell.count += 1;
    else cells.set(key, { x: col * size, y: row * size, count: 1 });
  }
  let max = 0;
  for (const cell of cells.values()) max = Math.max(max, cell.count);
  return { cells: [...cells.values()], max };
}
