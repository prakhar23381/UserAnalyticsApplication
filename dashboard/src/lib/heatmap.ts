import type { Box, Device, HeatmapClick, RankedElement } from './types';

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
  key?: string; // the element clicked (GET /api/elements)
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
    else points.push(click.key ? { ...point, key: click.key } : point);
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

// ---- Elements: numbered badges and the element heatmap ----

/** How many of the top elements get a numbered badge (M4-D3). */
export const BADGE_COUNT = 10;

export interface ElementMark {
  rank: number;
  key: string;
  x: number; // where the badge goes, in reference px
  y: number;
  box: Box | null; // the element's box at the reference width, when the tracker recorded one
}

/** A recorded box placed on the reference layout the way its click is: both corners mapped. */
export function placeBox(box: Box, click: HeatmapClick, device: Device, refHeight: number | null = null): Box {
  const topLeft = placeClick({ ...click, x: box.x, y: box.y }, device, refHeight);
  const bottomRight = placeClick({ ...click, x: box.x + box.w, y: box.y + box.h }, device, refHeight);
  return { x: topLeft.x, y: topLeft.y, w: bottomRight.x - topLeft.x, h: bottomRight.y - topLeft.y };
}

/**
 * A badge for each ranked element that has clicks in the response: at the
 * centre of its newest recorded box, mapped like its clicks, else at the
 * middle of its clicks on the canvas (M4-D3).
 */
export function elementMarks(
  clicks: HeatmapClick[],
  device: Device,
  elements: { rank: number; key: string }[],
  count = BADGE_COUNT,
): ElementMark[] {
  const refHeight = referenceHeight(clicks, device);
  const width = REFERENCE_WIDTH[device];
  const marks: ElementMark[] = [];
  for (const { rank, key } of elements.slice(0, count)) {
    const own = clicks.filter((click) => click.key === key); // newest first, as the API sends them
    const withBox = own.find((click) => click.box);
    if (withBox?.box) {
      const box = placeBox(withBox.box, withBox, device, refHeight);
      marks.push({ rank, key, x: box.x + box.w / 2, y: box.y + box.h / 2, box });
      continue;
    }
    const points = own.map((click) => placeClick(click, device, refHeight)).filter((point) => point.x >= 0 && point.x < width);
    if (points.length === 0) continue;
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    marks.push({ rank, key, x, y, box: null });
  }
  return marks;
}

// ---- Heat: the colour scale and how strongly each click counts ----

/** Blur radius of one click, in reference px. */
export const HEAT_RADIUS = 36;

// Cold to hot: transparent → blue → cyan → green → yellow → red (M4-D4).
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [0, 0, 255]],
  [0.25, [0, 0, 255]],
  [0.45, [0, 255, 255]],
  [0.6, [0, 255, 0]],
  [0.8, [255, 255, 0]],
  [1, [255, 0, 0]],
];

/** The colour for an intensity from 0 (no clicks) to 1 (the busiest spot), as [r, g, b, a] in 0–255. */
export function heatColor(t: number): [number, number, number, number] {
  const v = Math.min(1, Math.max(0, t));
  let i = 1;
  while (i < HEAT_STOPS.length - 1 && v > HEAT_STOPS[i][0]) i++;
  const [t0, c0] = HEAT_STOPS[i - 1];
  const [t1, c1] = HEAT_STOPS[i];
  const f = t1 === t0 ? 0 : (v - t0) / (t1 - t0);
  const mix = (k: number) => Math.round(c0[k] + (c1[k] - c0[k]) * f);
  // Faint where few clicks overlap, nearly opaque at the hottest spots.
  return [mix(0), mix(1), mix(2), Math.round(Math.min(1, v * 1.8) * 0.85 * 255)];
}

/** heatColor for every intensity byte, as a lookup table (256 × RGBA). */
export function heatPalette(): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) table.set(heatColor(i / 255), i * 4);
  return table;
}

/**
 * How much one click adds to the intensity layer: enough for a few overlapping
 * clicks to stand out, little enough that thousands don't flatten into one
 * blob. The layer is then stretched so its busiest spot is the hottest.
 */
export function heatAlpha(points: Point[], radius = HEAT_RADIUS): number {
  const { max } = binPoints(points, radius);
  if (max === 0) return 0;
  return Math.min(0.6, Math.max(0.04, 1.2 / max));
}

/**
 * How a ranked element reads in the sidebar: `name` is its text, else
 * `#id`, else its tag and first class; `detail` is the selector (or key) to copy.
 */
export function elementLabel(element: Pick<RankedElement, 'key' | 'selector' | 'tag' | 'id' | 'classes' | 'text'>): {
  name: string;
  detail: string;
} {
  const text = element.text?.trim();
  let name: string;
  if (text) name = text.length > 40 ? `${text.slice(0, 39)}…` : text;
  else if (element.id) name = `#${element.id}`;
  else if (element.tag) name = element.classes ? `${element.tag}.${element.classes.split(' ')[0]}` : element.tag;
  else name = element.key;
  return { name, detail: element.selector ?? element.key };
}

// ---- Area tool ----

/** A rectangle on the reference layout, in whole px. */
export type Area = Box;

/** A rectangle from two corners dragged in any direction, kept on the canvas. */
export function areaFrom(a: Point, b: Point, width: number, height: number): Area {
  const clampX = (v: number) => Math.min(Math.max(Math.round(v), 0), width);
  const clampY = (v: number) => Math.min(Math.max(Math.round(v), 0), height);
  const x1 = clampX(Math.min(a.x, b.x));
  const y1 = clampY(Math.min(a.y, b.y));
  return { x: x1, y: y1, w: clampX(Math.max(a.x, b.x)) - x1, h: clampY(Math.max(a.y, b.y)) - y1 };
}

/** `?area=x,y,w,h` → an area, or null when missing, malformed or too small to mean anything. */
export function parseArea(value: string | null): Area | null {
  if (!value) return null;
  const parts = value.split(',');
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,6}$/.test(part))) return null;
  const [x, y, w, h] = parts.map(Number);
  return w >= 4 && h >= 4 ? { x, y, w, h } : null;
}

export const areaParam = (area: Area): string => [area.x, area.y, area.w, area.h].join(',');

/** How many points fall inside the area (edges included). */
export function countInArea(points: Point[], area: Area): number {
  return points.filter((p) => p.x >= area.x && p.x <= area.x + area.w && p.y >= area.y && p.y <= area.y + area.h).length;
}

// ---- CSV export ----

/**
 * One CSV cell: quoted when needed, and a leading = + - @ neutralised so a
 * spreadsheet doesn't run it as a formula (element text comes from any site).
 */
function csvCell(value: string | number | null): string {
  if (value === null) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The ranked elements as CSV, with a header row. */
export function elementsCsv(elements: RankedElement[]): string {
  const header = ['rank', 'element', 'selector', 'clicks', 'share', 'sessions'];
  const rows = elements.map((element) => [
    element.rank,
    elementLabel(element).name,
    element.selector ?? element.key,
    element.clicks,
    element.share,
    element.sessions,
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
