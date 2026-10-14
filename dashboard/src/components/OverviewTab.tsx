'use client';

import { AppWindow, FileText, Globe, type LucideIcon, MonitorSmartphone, Signpost, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import PageHeading from '@/components/PageHeading';
import DeviceSplit from '@/components/overview/DeviceSplit';
import StatTile from '@/components/overview/StatTile';
import TopPages from '@/components/overview/TopPages';
import ValueBars from '@/components/overview/ValueBars';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { overviewUrl, useApi } from '@/lib/api';
import { countryName, RANGES } from '@/lib/filters';
import { formatDuration } from '@/lib/format';
import { useApiFilters, useDashboardHref, useFilters } from '@/lib/navigation';
import { formatCount, formatRate, periodDelta } from '@/lib/overview';
import type { OverviewResponse } from '@/lib/types';

// Recharts loads with this tab only, not with Sessions or Heatmaps.
const SessionsChart = dynamic(() => import('@/components/overview/SessionsChart'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-surface-2" />,
});

export function Card({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-ink-3" aria-hidden="true" />
        {title}
      </h2>
      {children}
    </section>
  );
}

/** The Overview's content for one response; also used by the UI lab with sample data. */
export function OverviewContent({
  data,
  period,
  heatmapHref,
  filterHref,
}: {
  data: OverviewResponse;
  period: string | null;
  heatmapHref: (pageUrl: string) => string;
  /** A link that narrows the segment to one value of a list filter. */
  filterHref: (param: 'browsers' | 'countries', value: string) => string;
}) {
  const { totals } = data;
  // Comparing with a period that had no sessions isn't meaningful (every rate would "change" from 0).
  const previous = data.previous && data.previous.sessions > 0 ? data.previous : null;
  const counts = { kind: 'relative', upIsGood: true } as const;
  const tiles = [
    { label: 'Sessions', value: formatCount(totals.sessions), delta: periodDelta(totals.sessions, previous?.sessions, counts) },
    { label: 'Page views', value: formatCount(totals.page_views), delta: periodDelta(totals.page_views, previous?.page_views, counts) },
    { label: 'Clicks', value: formatCount(totals.clicks), delta: periodDelta(totals.clicks, previous?.clicks, counts) },
    {
      label: 'Avg. duration',
      value: formatDuration(totals.avg_duration_ms),
      delta: periodDelta(totals.avg_duration_ms, previous?.avg_duration_ms, counts),
    },
    {
      label: 'Pages per session',
      value: totals.pages_per_session.toFixed(1),
      delta: periodDelta(totals.pages_per_session, previous?.pages_per_session, counts),
    },
    {
      label: 'Bounce rate',
      value: formatRate(totals.bounce_rate),
      delta: periodDelta(totals.bounce_rate, previous?.bounce_rate, { kind: 'points', upIsGood: false }),
    },
  ];

  return (
    <div className="space-y-4">
      {period && (
        <p className="text-xs text-ink-3">
          {previous ? `Change vs the ${period}` : `No sessions in the ${period} to compare with`}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} period={period ?? undefined} />
        ))}
      </div>
      {totals.sessions === 0 ? (
        <EmptyState title="No sessions in this segment">Try a longer date range, more devices or fewer filters in the filter bar.</EmptyState>
      ) : (
        <>
          <Card title="Sessions over time" icon={TrendingUp}>
            <SessionsChart series={data.series} />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Top pages by page views" icon={FileText}>
              <TopPages pages={data.top_pages} heatmapHref={heatmapHref} />
            </Card>
            <Card title="Sessions by device" icon={MonitorSmartphone}>
              <DeviceSplit devices={data.devices} />
            </Card>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Browsers" icon={AppWindow}>
              <ValueBars
                total={totals.sessions}
                rows={data.browsers.map(({ value, sessions }) => ({ key: value, label: value, sessions, filterHref: filterHref('browsers', value) }))}
              />
            </Card>
            <Card title="Countries" icon={Globe}>
              <ValueBars
                total={totals.sessions}
                rows={data.countries.map(({ value, sessions }) => ({
                  key: value ?? 'unknown',
                  label: countryName(value ?? 'unknown'),
                  sessions,
                  filterHref: filterHref('countries', value ?? 'unknown'),
                }))}
              />
            </Card>
            <Card title="Traffic sources" icon={Signpost}>
              <ValueBars total={totals.sessions} rows={data.sources.map(({ value, sessions }) => ({ key: value, label: value, sessions }))} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function OverviewTab() {
  const hrefFor = useDashboardHref();
  const { range } = useFilters();
  // keepPreviousData: a new segment loads under the old picture, which dims instead of flashing.
  const { data, error, isLoading } = useApi<OverviewResponse>(overviewUrl(useApiFilters()), { keepPreviousData: true });
  const preset = RANGES.find((option) => option.value === range);

  const heading = (
    <PageHeading title="Overview">Totals and trends for the sessions in the segment above.</PageHeading>
  );
  if (!data) return <>{heading}{error ? <ErrorState error={error} /> : <LoadingState rows={4} />}</>;

  return (
    <>
      {heading}
      {error && <ErrorState error={error} stale />}
      <div className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <OverviewContent
          data={data}
          period={preset?.previous ?? null}
          heatmapHref={(pageUrl) => hrefFor({ tab: 'heatmaps', page: pageUrl })}
          filterHref={(param, value) => hrefFor({ [param]: value, p: null })}
        />
      </div>
    </>
  );
}
