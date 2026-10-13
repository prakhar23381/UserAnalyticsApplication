'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import Heatmap, { type HeatmapMode } from '@/components/Heatmap';
import PageSelector from '@/components/PageSelector';
import Segmented from '@/components/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { DEMO_URL, heatmapUrl, pagesUrl, useApi } from '@/lib/api';
import { pathOf } from '@/lib/format';
import { layoutClicks } from '@/lib/heatmap';
import type { Device, HeatmapResponse, PagesResponse } from '@/lib/types';

const DEVICES: { value: Device; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];
const MODES: { value: HeatmapMode; label: string }[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'grid', label: 'Grid' },
];

const parseDevice = (value: string | null): Device =>
  DEVICES.find((device) => device.value === value)?.value ?? 'desktop';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${n === 1 ? word : `${word}s`}`;

export default function HeatmapView() {
  const router = useRouter();
  const params = useSearchParams();
  const device = parseDevice(params.get('device'));
  const mode: HeatmapMode = params.get('mode') === 'grid' ? 'grid' : 'dots';

  const pages = useApi<PagesResponse>(pagesUrl());
  // Without ?page=, show the most-clicked page (the API sorts by clicks)...
  const defaultPage = pages.data?.data[0]?.page_url;
  const page = params.get('page') ?? defaultPage ?? null;
  // ...and pin it in the URL, so a poll that reorders the list can't switch pages under the reader.
  useEffect(() => {
    if (params.get('page') || !defaultPage) return;
    const query = new URLSearchParams(params);
    query.set('page', defaultPage);
    router.replace(`/heatmap?${query}`, { scroll: false });
  }, [defaultPage, params, router]);
  // keepPreviousData: the old picture stays until the new one arrives. The
  // stage draws from the response's own page_url, so page and clicks always match.
  const heatmap = useApi<HeatmapResponse>(page ? heatmapUrl(page, device) : null, { keepPreviousData: true });
  const layout = useMemo(
    () => (heatmap.data ? layoutClicks(heatmap.data.clicks, parseDevice(heatmap.data.device)) : null),
    [heatmap.data],
  );

  const hrefFor = (next: { page?: string; device?: Device; mode?: HeatmapMode }) => {
    const query = new URLSearchParams();
    const nextPage = next.page ?? page;
    if (nextPage) query.set('page', nextPage);
    const nextDevice = next.device ?? device;
    if (nextDevice !== 'desktop') query.set('device', nextDevice);
    const nextMode = next.mode ?? mode;
    if (nextMode !== 'dots') query.set('mode', nextMode);
    return `/heatmap?${query}`;
  };

  if (!page) {
    if (pages.error) return <ErrorState error={pages.error} />;
    if (!pages.data) return <LoadingState />;
    return (
      <EmptyState title="No pages tracked yet">
        Open the{' '}
        <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline dark:text-indigo-400">
          demo site
        </a>{' '}
        and click around; its pages show up here.
      </EmptyState>
    );
  }

  const data = heatmap.data;
  // What is on screen, which lags the URL while the next response loads.
  const shownDevice = parseDevice(data?.device ?? device);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <PageSelector
          pages={pages.data?.data ?? []}
          value={data?.page_url ?? page}
          onChange={(pageUrl) => router.push(hrefFor({ page: pageUrl }), { scroll: false })}
        />
        <Segmented label="Device" options={DEVICES} value={device} hrefFor={(value) => hrefFor({ device: value })} />
        <Segmented label="Show" options={MODES} value={mode} hrefFor={(value) => hrefFor({ mode: value })} />
      </div>

      {heatmap.error && <ErrorState error={heatmap.error} stale={Boolean(data)} />}
      {!data && !heatmap.error && <LoadingState />}

      {data && layout && (
        <div className={heatmap.isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {data.total_clicks === 0 ? (
            <EmptyState title={`No ${shownDevice} clicks on ${pathOf(data.page_url)} yet`}>
              Try another device, or open the page at that size and click around.
            </EmptyState>
          ) : (
            <>
              <p className="mb-3 text-sm text-neutral-500">
                {plural(layout.points.length, 'click')} on the {shownDevice} layout ({layout.width} px wide)
                {mode === 'grid' && ', in 40 px cells: the darker, the more clicks'}
                {layout.outside > 0 && ` · ${plural(layout.outside, 'click')} fell outside it`}
                {data.total_clicks > data.clicks.length &&
                  ` · showing the newest ${data.clicks.length.toLocaleString()} of ${data.total_clicks.toLocaleString()}`}
              </p>
              <Heatmap pageUrl={data.page_url} layout={layout} mode={mode} />
            </>
          )}
        </div>
      )}
    </>
  );
}
