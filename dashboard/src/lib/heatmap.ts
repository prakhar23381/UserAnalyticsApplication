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
  height: number; // the tallest document among the clicks, at the reference width
  points: Point[]; // clicks that land on the canvas, in reference px
  outside: number; // clicks that fall off its left or right edge
}

export interface Cell {
  x: number; // top-left corner, in reference px
  y: number;
  count: number;
}

// The tracker records doc_h as scrollHeight, which is the window's height when
// the page is shorter than the window. Only a taller page says how tall it is.
const tallerThanWindow = (click: HeatmapClick) => click.doc_h > click.viewport_h;

/**
 * The page's height at the reference width, from clicks recorded in a window
 * exactly that wide: their most common doc_h (the taller on a tie). Null on
 * desktop, and when no click qualifies. A page no taller than its window
 * reports the window's height, so those clicks don't count.
 */
export function referenceHeight(clicks: HeatmapClick[], device: Device): number | null {
  if (device === 'desktop') return null;
  const counts = new Map<number, number>();
  for (const click of clicks) {
    if (click.viewport_w !== REFERENCE_WIDTH[device] || !tallerThanWindow(click)) continue;
    counts.set(click.doc_h, (counts.get(click.doc_h) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [height, count] of counts) {
    if (count > bestCount || (count === bestCount && best !== null && height > best)) {
      best = height;
      bestCount = count;
    }
  }
  return best;
}

// refHeight / doc_h for a click on a page taller than its window, else 1
function heightRatio(click: HeatmapClick, refHeight: number | null): number {
  return refHeight !== null && tallerThanWindow(click) ? refHeight / click.doc_h : 1;
}

/**
 * Where a click lands when its page is drawn at the device's reference width.
 *
 * x follows how layouts usually respond to width: desktop pages are a centred
 * column, so x keeps its distance from the centre; phone and tablet layouts are
 * fluid, so x keeps its share of the width.
 *
 * y is px from the top of the document. On a fluid layout, text reflows with
 * width and moves everything below it, so y keeps its share of the page's
 * height when `refHeight` (from `referenceHeight`) is known. Desktop y stays as
 * recorded: a fixed-width column doesn't reflow.
 */
export function placeClick(click: HeatmapClick, device: Device, refHeight: number | null = null): Point {
  const width = REFERENCE_WIDTH[device];
  const y = click.y * heightRatio(click, refHeight);
  if (click.doc_w <= 0) return { x: click.x, y }; // no width recorded: take x as is
  const x =
    device === 'desktop' ? click.x + (width - click.doc_w) / 2 : (click.x / click.doc_w) * width;
  return { x, y };
}

export function layoutClicks(clicks: HeatmapClick[], device: Device): ClickLayout {
  const width = REFERENCE_WIDTH[device];
  const refHeight = referenceHeight(clicks, device);
  const points: Point[] = [];
  let height = 0;
  let outside = 0;
  for (const click of clicks) {
    const point = placeClick(click, device, refHeight);
    height = Math.max(height, click.doc_h * heightRatio(click, refHeight), point.y);
    if (point.x < 0 || point.x >= width) outside += 1;
    else points.push(point);
  }
  return { width, height: Math.ceil(height), points, outside };
}

/**
 * The page to draw behind the clicks, with `cf_preview=1` so the tracker on it
 * stays quiet. Null for anything but http(s): ingestion is open, so a stored
 * page_url is untrusted input.
 */
export function previewUrl(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.searchParams.set('cf_preview', '1');
    return url.toString();
  } catch {
    return null;
  }
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
