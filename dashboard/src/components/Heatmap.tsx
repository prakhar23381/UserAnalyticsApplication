'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  binPoints,
  type ClickLayout,
  type ElementMark,
  GRID_CELL,
  HEAT_RADIUS,
  heatAlpha,
  heatPalette,
  type Point,
  previewUrl,
} from '@/lib/heatmap';

export type HeatmapMode = 'dots' | 'grid' | 'heat';

interface Props {
  pageUrl: string;
  layout: ClickLayout;
  mode: HeatmapMode;
  /** Numbered badges on the top elements. */
  marks?: ElementMark[];
  /** The element whose badge is emphasised (hovered in the ranking). */
  highlight?: string | null;
  /** The element shown alone (element heatmap): its box is outlined. */
  focus?: string | null;
}

/**
 * Heat: every click adds a soft blob to an intensity layer (alpha only). The
 * layer is then stretched so the busiest spot is the hottest, and coloured
 * through the cold-to-hot palette. Drawn at reference px, so it scales with the
 * page like the other layers.
 */
function HeatLayer({ width, height, points }: { width: number; height: number; points: Point[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const palette = useMemo(() => heatPalette(), []);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.clearRect(0, 0, width, height);
    const alpha = heatAlpha(points);
    for (const { x, y } of points) {
      const blob = context.createRadialGradient(x, y, 0, x, y, HEAT_RADIUS);
      blob.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
      blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = blob;
      context.fillRect(x - HEAT_RADIUS, y - HEAT_RADIUS, HEAT_RADIUS * 2, HEAT_RADIUS * 2);
    }
    if (points.length === 0 || width === 0 || height === 0) return;
    const image = context.getImageData(0, 0, width, height);
    const { data } = image;
    let peak = 0;
    for (let i = 3; i < data.length; i += 4) peak = Math.max(peak, data[i]);
    if (peak === 0) return;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const intensity = Math.round((data[i + 3] * 255) / peak);
      data[i] = palette[intensity * 4];
      data[i + 1] = palette[intensity * 4 + 1];
      data[i + 2] = palette[intensity * 4 + 2];
      data[i + 3] = palette[intensity * 4 + 3];
    }
    context.putImageData(image, 0, 0);
  }, [width, height, points, palette]);

  return <canvas ref={canvasRef} width={width} height={height} className="absolute inset-0" aria-hidden="true" />;
}

/**
 * The page at its reference width with the clicks drawn over it, scaled down
 * to fit the container. The iframe is sandboxed (no scripts, no navigation)
 * and ignores the pointer; it is only a picture of the page.
 */
export default function Heatmap({ pageUrl, layout, mode, marks = [], highlight = null, focus = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const { width, height, points } = layout;
  const grid = useMemo(() => (mode === 'grid' ? binPoints(points) : null), [mode, points]);
  const scale = Math.min(1, containerWidth / width);
  // Dots and badges keep a readable size on screen when a wide layout is scaled down a lot.
  const radius = scale > 0 ? Math.max(8, 4 / scale) : 8;
  const badge = scale > 0 ? 12 / scale : 12;
  const src = previewUrl(pageUrl);
  const focusBox = focus ? marks.find((mark) => mark.key === focus)?.box : null;

  return (
    <div ref={containerRef} className="w-full">
      {scale > 0 && (
        <div
          className="mx-auto overflow-hidden rounded-lg border border-line bg-surface-2"
          style={{ width: width * scale, height: height * scale }}
        >
          <div className="relative origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
            {src && (
              <iframe
                src={src}
                title="Page preview"
                width={width}
                height={height}
                sandbox=""
                scrolling="no"
                referrerPolicy="no-referrer"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 border-0 bg-white"
              />
            )}
            {mode === 'heat' && <HeatLayer width={width} height={height} points={points} />}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              className="absolute inset-0"
              role="img"
              aria-label={`${points.length} clicks${marks.length > 0 ? `; the top ${marks.length} elements are numbered` : ''}`}
            >
              {mode === 'grid' &&
                grid?.cells.map((cell) => (
                  <rect
                    key={`${cell.x}:${cell.y}`}
                    x={cell.x}
                    y={cell.y}
                    width={GRID_CELL}
                    height={GRID_CELL}
                    className="fill-red-600"
                    fillOpacity={0.15 + 0.6 * (cell.count / grid.max)}
                  >
                    <title>{`${cell.count} ${cell.count === 1 ? 'click' : 'clicks'}`}</title>
                  </rect>
                ))}
              {mode === 'dots' &&
                points.map((point, i) => (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    className="fill-red-600 stroke-white"
                    fillOpacity={0.45}
                    strokeOpacity={0.8}
                    strokeWidth={radius / 5}
                  />
                ))}
              {focusBox && (
                <rect
                  x={focusBox.x}
                  y={focusBox.y}
                  width={focusBox.w}
                  height={focusBox.h}
                  fill="none"
                  className="stroke-blue-600"
                  strokeWidth={2 / scale}
                  strokeDasharray={`${6 / scale} ${4 / scale}`}
                />
              )}
              {marks.map((mark) => {
                const active = mark.key === highlight || mark.key === focus;
                const r = active ? badge * 1.25 : badge;
                return (
                  <g key={mark.key}>
                    <title>{`#${mark.rank}`}</title>
                    {active && <circle cx={mark.x} cy={mark.y} r={r + 4 / scale} className="fill-white/80" />}
                    <circle cx={mark.x} cy={mark.y} r={r} className="fill-blue-700 stroke-white" strokeWidth={1.5 / scale} />
                    <text
                      x={mark.x}
                      y={mark.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-white font-semibold"
                      style={{ fontSize: r * 1.05 }}
                    >
                      {mark.rank}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
