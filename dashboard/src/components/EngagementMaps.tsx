'use client';

import { Gauge } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';
import { DEVICE_META } from '@/components/DeviceLabel';
import Heatmap from '@/components/Heatmap';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { engagementUrl, useApi } from '@/lib/api';
import { engagementMap, normalize, ROW_PX } from '@/lib/engagement';
import { formatDuration, pathOf } from '@/lib/format';
import { useApiFilters } from '@/lib/navigation';
import { formatRate } from '@/lib/overview';
import type { Device, EngagementResponse } from '@/lib/types';

export type EngagementKind = 'scroll' | 'attention';

const LEGEND: Record<EngagementKind, [string, string]> = {
  scroll: ['Everyone reached', 'Nobody'],
  attention: ['Most time', 'Least'],
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-lg font-semibold tracking-tight">{children}</dd>
    </div>
  );
}

/**
 * The scroll map (how far down visitors got) and the attention map (where the
 * page was on screen while they were active), from page-view summaries
 * (GET /api/engagement), with a summary beside the page.
 */
export default function EngagementMaps({ page, device, kind }: { page: string; device: Device; kind: EngagementKind }) {
  const apiFilters = useApiFilters();
  // keepPreviousData: the old picture stays until the new one arrives, drawn from the response's own page and device.
  const { data, error, isLoading } = useApi<EngagementResponse>(engagementUrl(page, device, apiFilters), { keepPreviousData: true });
  const shownDevice = (data?.device ?? device) as Device;
  const map = useMemo(() => (data ? engagementMap(data.views, data.device as Device) : null), [data]);

  if (!data || !map) return error ? <ErrorState error={error} /> : <LoadingState />;
  if (data.page_views === 0) {
    return (
      <EmptyState title={`No ${DEVICE_META[shownDevice].label.toLowerCase()} visit summaries for ${pathOf(data.page_url)} yet`}>
        The tracker sends one when a visitor leaves or hides the page. Visits recorded before it did have none.
      </EmptyState>
    );
  }

  const rows =
    kind === 'scroll'
      ? {
          values: map.reach,
          titles: map.reach.map((share, row) => `${formatRate(share)} of visitors reached ${row * ROW_PX}–${(row + 1) * ROW_PX} px`),
          rowPx: ROW_PX,
        }
      : {
          values: normalize(map.attention),
          titles: map.attention.map((ms) => `On screen for ${formatDuration(ms)} on average`),
          rowPx: ROW_PX,
        };
  const lines = [
    { y: map.fold, label: 'Average fold' },
    ...(kind === 'scroll' && map.half !== null && map.half < map.height - ROW_PX ? [{ y: map.half, label: 'Half the visitors got this far' }] : []),
  ];
  const [hot, cold] = LEGEND[kind];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="order-last rounded-xl border border-line bg-surface-2/60 p-4 shadow-xs lg:order-none lg:self-start">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold">
          <Gauge className="size-4 text-ink-3" aria-hidden="true" />
          Engagement
        </h2>
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Fact label="Visits summarised">{map.views.toLocaleString('en')}</Fact>
          <Fact label="Average active time">{formatDuration(map.avgActiveMs)}</Fact>
          <Fact label="Average share of the page seen">{formatRate(map.avgDepth)}</Fact>
          <Fact label="Half the visitors got to">{map.half === null ? '—' : `${Math.round(map.half).toLocaleString('en')} px`}</Fact>
        </dl>
        <p className="mt-4 text-xs text-ink-3">
          {kind === 'scroll'
            ? 'Each 50 px row is coloured by the share of visits that saw it.'
            : 'Each 50 px row is coloured by the average active time it spent on screen.'}{' '}
          Active means visible, with input in the last 15 s.
        </p>
      </aside>
      <div className={`min-w-0 ${isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}`}>
        <div className="rounded-xl border border-line bg-surface p-3 shadow-xs">
          <Heatmap
            pageUrl={data.page_url}
            layout={{ width: map.width, height: map.height, points: [], outside: 0 }}
            mode="dots"
            rows={rows}
            lines={lines}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-ink-3">
            <p>
              <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 tabular-nums text-ink-2">
                {data.page_views.toLocaleString('en')} {data.page_views === 1 ? 'visit' : 'visits'}
              </span>{' '}
              on the {DEVICE_META[shownDevice].label.toLowerCase()} layout ({map.width} px wide)
              {data.page_views > data.views.length && ` · showing the newest ${data.views.length.toLocaleString('en')}`}
            </p>
            <span className="inline-flex items-center gap-2">
              {hot}
              <span
                className="h-2.5 w-28 rounded-full"
                style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff)' }}
                aria-hidden="true"
              />
              {cold}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
