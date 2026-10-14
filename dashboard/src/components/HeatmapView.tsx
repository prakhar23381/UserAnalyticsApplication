'use client';

import { CircleDot, Eye, EyeOff, Grid3x3 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { DEVICE_META } from '@/components/DeviceLabel';
import Heatmap, { type HeatmapMode } from '@/components/Heatmap';
import PageHeading from '@/components/PageHeading';
import PageSelector from '@/components/PageSelector';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import ToggleGroup, { type ToggleOption } from '@/components/ToggleGroup';
import { DEMO_URL, heatmapUrl, pagesUrl, useApi } from '@/lib/api';
import { pathOf } from '@/lib/format';
import { layoutClicks } from '@/lib/heatmap';
import { useApiFilters, useDashboardHref, useFilters } from '@/lib/navigation';
import { isWatched, toggleWatch } from '@/lib/segments';
import { useWatchlist } from '@/lib/storage';
import type { Device, HeatmapResponse, PagesResponse } from '@/lib/types';

const DEVICES: ToggleOption<Device>[] = (['desktop', 'tablet', 'mobile'] as const).map((device) => ({
  value: device,
  ...DEVICE_META[device],
}));
const MODES: ToggleOption<HeatmapMode>[] = [
  { value: 'dots', label: 'Dots', icon: CircleDot },
  { value: 'grid', label: 'Grid', icon: Grid3x3 },
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
  return (
    <span className="inline-flex items-center gap-2">
      Fewer
      <span className="h-2.5 w-24 rounded-full bg-gradient-to-r from-red-600/15 to-red-600/75" aria-hidden="true" />
      More clicks per 40 px cell
    </span>
  );
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
  const mode: HeatmapMode = params.get('mode') === 'grid' ? 'grid' : 'dots';

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
  const heatmap = useApi<HeatmapResponse>(page && !deviceFiltered ? heatmapUrl(page, device, apiFilters) : null, {
    keepPreviousData: true,
  });
  const layout = useMemo(
    () => (heatmap.data ? layoutClicks(heatmap.data.clicks, parseDevice(heatmap.data.device)) : null),
    [heatmap.data],
  );

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

  // Below the toolbar: the drawing, or why there isn't one.
  const stage = deviceFiltered ? (
    <EmptyState title={`${DEVICE_META[device].label} is left out of the segment`}>
      Add it in the filter bar, or pick a device that&apos;s included.
    </EmptyState>
  ) : (
    <>
      {heatmap.error && <ErrorState error={heatmap.error} stale={Boolean(data)} />}
      {!data && !heatmap.error && <LoadingState />}
      {data && layout && (
        <div className={heatmap.isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.total_clicks === 0 ? (
            <EmptyState title={`No ${DEVICE_META[shownDevice].label.toLowerCase()} clicks on ${pathOf(data.page_url)} yet`}>
              Try another device, a longer date range or fewer filters, or open the page at that size and click around.
            </EmptyState>
          ) : (
            <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
              <Heatmap pageUrl={data.page_url} layout={layout} mode={mode} />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-ink-3">
                <p>
                  <span className="font-medium text-ink-2">{plural(layout.points.length, 'click')}</span> on the{' '}
                  {DEVICE_META[shownDevice].label.toLowerCase()} layout ({layout.width} px wide)
                  {layout.outside > 0 && ` · ${plural(layout.outside, 'click')} fell outside it`}
                  {data.total_clicks > data.clicks.length &&
                    ` · showing the newest ${data.clicks.length.toLocaleString()} of ${data.total_clicks.toLocaleString()}`}
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
          onChange={(pageUrl) => router.push(hrefFor({ page: pageUrl }), { scroll: false })}
        />
        <ToggleGroup
          label="Device"
          options={deviceOptions}
          value={device}
          hrefFor={(value) => hrefFor({ device: value === 'desktop' ? null : value })}
        />
        <ToggleGroup label="Show" options={MODES} value={mode} hrefFor={(value) => hrefFor({ mode: value === 'dots' ? null : value })} />
        <WatchPageButton pageUrl={data?.page_url ?? page} />
      </div>
      {stage}
    </>
  );
}
