'use client';

import { ArrowDownToLine, ChevronsRight, CircleDot, Eye, EyeOff, Flame, Grid3x3, MousePointerClick, SquareDashedMousePointer, Timer, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { DEVICE_META } from '@/components/DeviceLabel';
import ElementsSidebar from '@/components/ElementsSidebar';
import EngagementMaps from '@/components/EngagementMaps';
import Heatmap, { type HeatmapMode } from '@/components/Heatmap';
import PageHeading from '@/components/PageHeading';
import PageSelector from '@/components/PageSelector';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import ToggleGroup, { type ToggleOption } from '@/components/ToggleGroup';
import { DEMO_URL, elementsUrl, heatmapUrl, pagesUrl, useApi } from '@/lib/api';
import { pathOf } from '@/lib/format';
import { areaParam, countInArea, elementLabel, elementMarks, layoutClicks, parseArea } from '@/lib/heatmap';
import { formatRate } from '@/lib/overview';
import { useApiFilters, useDashboardHref, useFilters } from '@/lib/navigation';
import { isWatched, toggleWatch } from '@/lib/segments';
import { useWatchlist } from '@/lib/storage';
import type { Device, ElementsResponse, HeatmapResponse, PagesResponse } from '@/lib/types';

const DEVICES: ToggleOption<Device>[] = (['desktop', 'tablet', 'mobile'] as const).map((device) => ({
  value: device,
  ...DEVICE_META[device],
}));
const MODES: ToggleOption<HeatmapMode>[] = [
  { value: 'dots', label: 'Dots', icon: CircleDot },
  { value: 'grid', label: 'Grid', icon: Grid3x3 },
  { value: 'heat', label: 'Heat', icon: Flame },
];

type MapKind = 'clicks' | 'scroll' | 'attention';
const MAPS: ToggleOption<MapKind>[] = [
  { value: 'clicks', label: 'Clicks', icon: MousePointerClick },
  { value: 'scroll', label: 'Scroll', icon: ArrowDownToLine },
  { value: 'attention', label: 'Attention', icon: Timer },
];

const parseDevice = (value: string | null): Device =>
  DEVICES.find((device) => device.value === value)?.value ?? 'desktop';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`;

function Legend({ mode }: { mode: HeatmapMode }) {
  if (mode === 'dots') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-full border border-white bg-red-600/60" aria-hidden="true" /> One click
      </span>
    );
  }
  if (mode === 'heat') {
    return (
      <span className="inline-flex items-center gap-2">
        Hot
        {/* The heat palette, hot to cold (lib/heatmap.ts heatColor). */}
        <span
          className="h-2.5 w-28 rounded-full"
          style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff)' }}
          aria-hidden="true"
        />
        Cold
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      Fewer
      <span className="h-2.5 w-24 rounded-full bg-gradient-to-r from-red-600/15 to-red-600/75" aria-hidden="true" />
      More clicks per 40 px cell
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 tabular-nums text-ink-2">{children}</span>;
}

/** Adds the page to My watchlist on the Overview (stored in this browser). */
function WatchPageButton({ pageUrl }: { pageUrl: string }) {
  const [watchlist, setWatchlist] = useWatchlist();
  const item = { kind: 'page', page_url: pageUrl } as const;
  const watched = isWatched(watchlist, item);
  return (
    <button
      type="button"
      aria-pressed={watched}
      onClick={() => setWatchlist(toggleWatch(watchlist, item))}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink sm:ml-auto"
    >
      {watched ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      {watched ? 'Unwatch page' : 'Watch page'}
    </button>
  );
}

export default function HeatmapView() {
  const router = useRouter();
  const params = useSearchParams();
  const hrefFor = useDashboardHref();
  const device = parseDevice(params.get('device'));
  const mapParam = params.get('map');
  const mapKind: MapKind = mapParam === 'scroll' || mapParam === 'attention' ? mapParam : 'clicks';
  const modeParam = params.get('mode');
  const mode: HeatmapMode = modeParam === 'grid' || modeParam === 'heat' ? modeParam : 'dots';
  // The element heatmap: one ranked element's clicks alone.
  const focus = params.get('element');
  const [hovered, setHovered] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // The area tool: a rectangle in reference px, kept in the URL; `drawing` while choosing one.
  const area = parseArea(params.get('area'));
  const [drawing, setDrawing] = useState(false);

  const filters = useFilters();
  const apiFilters = useApiFilters();
  // Devices left out of the segment can't be drawn.
  const deviceOptions = DEVICES.map((option) => ({ ...option, disabled: !filters.devices.includes(option.value) }));
  const deviceFiltered = !filters.devices.includes(device);

  const pages = useApi<PagesResponse>(pagesUrl(apiFilters));
  // Without ?page=, show the most-clicked page (the API sorts by clicks)...
  const defaultPage = pages.data?.data[0]?.page_url;
  const page = params.get('page') ?? defaultPage ?? null;
  // ...and pin it in the URL, so a poll that reorders the list can't switch pages under the reader.
  useEffect(() => {
    if (params.get('page') || !defaultPage) return;
    router.replace(hrefFor({ page: defaultPage }), { scroll: false });
  }, [defaultPage, params, router, hrefFor]);
  // keepPreviousData: the old picture stays until the new one arrives. The
  // stage draws from the response's own page_url, so page and clicks always match.
  const clicksShown = mapKind === 'clicks' && page && !deviceFiltered;
  const heatmap = useApi<HeatmapResponse>(clicksShown ? heatmapUrl(page, device, apiFilters) : null, {
    keepPreviousData: true,
  });
  const elements = useApi<ElementsResponse>(clicksShown ? elementsUrl(page, device, apiFilters) : null, {
    keepPreviousData: true,
  });
  const layout = useMemo(
    () => (heatmap.data ? layoutClicks(heatmap.data.clicks, parseDevice(heatmap.data.device)) : null),
    [heatmap.data],
  );
  // Badges only when the ranking is for the same page and device as the clicks on screen.
  const ranking =
    elements.data && heatmap.data && elements.data.page_url === heatmap.data.page_url && elements.data.device === heatmap.data.device
      ? elements.data
      : undefined;
  const marks = useMemo(
    () => (heatmap.data && ranking ? elementMarks(heatmap.data.clicks, parseDevice(heatmap.data.device), ranking.elements) : []),
    [heatmap.data, ranking],
  );
  const shownLayout = useMemo(
    () => (layout && focus ? { ...layout, points: layout.points.filter((point) => point.key === focus) } : layout),
    [layout, focus],
  );
  const focusedElement = focus ? ranking?.elements.find((element) => element.key === focus) : undefined;

  const heading = (
    <PageHeading title="Heatmaps">
      Where visitors click on a page, drawn over the live page at a fixed width for each device.
    </PageHeading>
  );

  if (!page) {
    if (pages.error) return <>{heading}<ErrorState error={pages.error} /></>;
    if (!pages.data) return <>{heading}<LoadingState /></>;
    return (
      <>
        {heading}
        <EmptyState title="No pages tracked yet">
          Open the{' '}
          <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">
            demo site
          </a>{' '}
          and click around; its pages show up here.
        </EmptyState>
      </>
    );
  }

  const data = heatmap.data;
  // What is on screen, which lags the URL while the next response loads.
  const shownDevice = parseDevice(data?.device ?? device);
  const pageViews = pages.data?.data.find((row) => row.page_url === data?.page_url)?.page_views;

  // Below the toolbar: the drawing, or why there isn't one.
  const stage = deviceFiltered ? (
    <EmptyState title={`${DEVICE_META[device].label} is left out of the segment`}>
      Add it in the filter bar, or pick a device that&apos;s included.
    </EmptyState>
  ) : (
    <>
      {heatmap.error && <ErrorState error={heatmap.error} stale={Boolean(data)} />}
      {!data && !heatmap.error && <LoadingState />}
      {data && layout && shownLayout && (
        <div className={heatmap.isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.total_clicks === 0 ? (
            <EmptyState title={`No ${DEVICE_META[shownDevice].label.toLowerCase()} clicks on ${pathOf(data.page_url)} yet`}>
              Try another device, a longer date range or fewer filters, or open the page at that size and click around.
            </EmptyState>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
              {focus && (
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span>
                    Only{' '}
                    <span className="font-medium">{focusedElement ? elementLabel(focusedElement).name : <span className="font-mono">{focus}</span>}</span>
                    : {plural(shownLayout.points.length, 'click')}
                  </span>
                  <Link
                    href={hrefFor({ element: null })}
                    scroll={false}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Show all clicks
                  </Link>
                </div>
              )}
              {area && (
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  <span>
                    Selected area: <span className="font-medium">{plural(countInArea(shownLayout.points, area), 'click')}</span>
                    {shownLayout.points.length > 0 &&
                      ` (${formatRate(countInArea(shownLayout.points, area) / shownLayout.points.length)} of the clicks drawn)`}
                  </span>
                  <Link
                    href={hrefFor({ area: null })}
                    scroll={false}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    Clear area
                  </Link>
                </div>
              )}
              <Heatmap
                pageUrl={data.page_url}
                layout={shownLayout}
                mode={mode}
                marks={marks}
                highlight={hovered}
                focus={focus}
                area={area}
                onArea={
                  drawing
                    ? (next) => {
                        setDrawing(false);
                        router.replace(hrefFor({ area: next.w >= 4 && next.h >= 4 ? areaParam(next) : null }), { scroll: false });
                      }
                    : undefined
                }
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-ink-3">
                <p className="flex flex-wrap items-center gap-2">
                  {pageViews !== undefined && (
                    <Chip>
                      {plural(pageViews, 'page view')}
                      {filters.devices.length > 1 && ' (all devices)'}
                    </Chip>
                  )}
                  <Chip>{plural(data.total_clicks, 'click')}</Chip>
                  <span>
                    on the {DEVICE_META[shownDevice].label.toLowerCase()} layout ({layout.width} px wide)
                  {layout.outside > 0 && ` · ${plural(layout.outside, 'click')} fell outside it`}
                  {data.total_clicks > data.clicks.length && ` · showing the newest ${data.clicks.length.toLocaleString()}`}
                  </span>
                </p>
                <Legend mode={mode} />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {heading}
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-line bg-surface p-3 shadow-xs">
        <PageSelector
          pages={pages.data?.data ?? []}
          value={data?.page_url ?? page}
          // Another page or device has another layout: the element and area don't carry over.
          onChange={(pageUrl) => router.push(hrefFor({ page: pageUrl, element: null, area: null }), { scroll: false })}
        />
        <ToggleGroup
          label="Device"
          options={deviceOptions}
          value={device}
          hrefFor={(value) => hrefFor({ device: value === 'desktop' ? null : value, element: null, area: null })}
        />
        <ToggleGroup
          label="Map"
          options={MAPS}
          value={mapKind}
          hrefFor={(value) => hrefFor({ map: value === 'clicks' ? null : value, element: null, area: null })}
        />
        {mapKind === 'clicks' && (
          <ToggleGroup label="Show" options={MODES} value={mode} hrefFor={(value) => hrefFor({ mode: value === 'dots' ? null : value })} />
        )}
        {mapKind === 'clicks' && (
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-ink-3">Tools</span>
            <button
              type="button"
              aria-pressed={drawing}
              onClick={() => setDrawing(!drawing)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium ${
                drawing ? 'border-accent bg-accent text-white' : 'border-line text-ink-2 hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <SquareDashedMousePointer className="size-4" aria-hidden="true" />
              {drawing ? 'Drag on the page…' : 'Select area'}
            </button>
          </div>
        )}
        <WatchPageButton pageUrl={data?.page_url ?? page} />
      </div>
      {deviceFiltered ? (
        stage
      ) : mapKind !== 'clicks' ? (
        <EngagementMaps page={page} device={device} kind={mapKind} />
      ) : (
        // One column under lg, with the ranking after the page; beside it from lg.
        <div className={sidebarOpen ? 'grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]' : ''}>
          {sidebarOpen ? (
            <ElementsSidebar
              data={ranking}
              exportName={`trailmark-elements-${pathOf(ranking?.page_url ?? page).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}-${device}.csv`}
              focus={focus}
              focusHrefFor={(key) => hrefFor({ element: key })}
              onHover={setHovered}
              onCollapse={() => setSidebarOpen(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mb-3 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <ChevronsRight className="size-4" aria-hidden="true" />
              Show ranking
            </button>
          )}
          <div className="min-w-0">{stage}</div>
        </div>
      )}
    </>
  );
}
