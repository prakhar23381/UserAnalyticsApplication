'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { binPoints, type ClickLayout, GRID_CELL, previewUrl } from '@/lib/heatmap';

export type HeatmapMode = 'dots' | 'grid';

interface Props {
  pageUrl: string;
  layout: ClickLayout;
  mode: HeatmapMode;
}

/**
 * The page at its reference width with the clicks drawn over it, scaled down
 * to fit the container. The iframe is sandboxed (no scripts, no navigation)
 * and ignores the pointer; it is only a picture of the page.
 */
export default function Heatmap({ pageUrl, layout, mode }: Props) {
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
  // Dots stay at least ~4 px on screen when a wide layout is scaled down a lot.
  const radius = scale > 0 ? Math.max(8, 4 / scale) : 8;
  const src = previewUrl(pageUrl);

  return (
    <div ref={containerRef} className="w-full">
      {scale > 0 && (
        <div
          className="mx-auto overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800"
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
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              className="absolute inset-0"
              role="img"
              aria-label={`${points.length} clicks`}
            >
              {grid
                ? grid.cells.map((cell) => (
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
                  ))
                : points.map((point, i) => (
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
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
