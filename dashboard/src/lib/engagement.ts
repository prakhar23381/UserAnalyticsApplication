// The scroll and attention maps (M5 in docs/v2-plan.md): page-view summaries
// from GET /api/engagement, placed on the device's reference layout the way
// clicks are (lib/heatmap.ts), as one value per 50 px row. Pure, so it's unit-tested.
import { heightRatio, REFERENCE_WIDTH, referenceHeight } from './heatmap';
import type { Device, EngagementView } from './types';

/** Row height of both maps, in reference px: the tracker's band size. */
export const ROW_PX = 50;

export interface EngagementMap {
  width: number; // the device's reference width
  height: number; // the tallest page among the views, at the reference width
  /** Per 50 px row from the top: share of views that saw it (scroll), 0–1. */
  reach: number[];
  /** Per row: average active ms with it on screen (attention). */
  attention: number[];
  fold: number; // the average window height: where the first screen ends
  half: number | null; // the deepest point at least half of the views reached
  avgActiveMs: number;
  avgDepth: number; // average share of the page seen, 0–1
  views: number;
}

const average = (values: number[]) => (values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

export function engagementMap(views: EngagementView[], device: Device): EngagementMap {
  const width = REFERENCE_WIDTH[device];
  const refHeight = referenceHeight(views, device);
  const ratios = views.map((view) => heightRatio(view, refHeight));
  const depths = views.map((view, i) => view.scroll_depth * ratios[i]);
  const height = Math.ceil(Math.max(0, ...views.map((view, i) => Math.max(view.doc_h, view.viewport_h) * ratios[i]), ...depths));
  const rows = Math.ceil(height / ROW_PX);

  const reach = Array.from({ length: rows }, (_, row) => {
    if (views.length === 0) return 0;
    const middle = (row + 0.5) * ROW_PX;
    return depths.filter((depth) => depth >= middle).length / views.length;
  });

  // Each recorded band lands in the reference row under its middle.
  const attention = new Array<number>(rows).fill(0);
  views.forEach((view, i) => {
    view.bands.forEach((ms, band) => {
      const row = Math.floor(((band + 0.5) * ROW_PX * ratios[i]) / ROW_PX);
      if (row < rows) attention[row] += ms;
    });
  });
  for (let row = 0; row < rows; row++) attention[row] = views.length > 0 ? attention[row] / views.length : 0;

  const sorted = [...depths].sort((a, b) => b - a);
  return {
    width,
    height,
    reach,
    attention,
    fold: average(views.map((view, i) => view.viewport_h * ratios[i])),
    half: sorted.length > 0 ? sorted[Math.ceil(sorted.length / 2) - 1] : null,
    avgActiveMs: average(views.map((view) => view.active_ms)),
    avgDepth: average(views.map((view) => (view.doc_h > 0 ? Math.min(1, view.scroll_depth / view.doc_h) : 1))),
    views: views.length,
  };
}

/** Values scaled to 0–1 by the largest, for colouring (all 0 when there are none). */
export function normalize(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 ? value / max : 0));
}
