'use client';

import type { ReactNode } from 'react';
import DeviceLabel, { DEVICE_META } from '@/components/DeviceLabel';
import EventBadge from '@/components/EventBadge';
import EventTimeline from '@/components/EventTimeline';
import { FilterEditor, FilterMenu } from '@/components/FilterEditor';
import Heatmap from '@/components/Heatmap';
import Logo, { LogoMark } from '@/components/Logo';
import Pagination from '@/components/Pagination';
import Watchlist from '@/components/overview/Watchlist';
import SegmentMenu from '@/components/SegmentMenu';
import { OverviewContent } from '@/components/OverviewTab';
import { LiveNote } from '@/components/SessionsTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import ToggleGroup from '@/components/ToggleGroup';
import { ApiError } from '@/lib/api';
import { ALL_DEVICES, FILTER_DEFS, type Filters } from '@/lib/filters';
import { layoutClicks } from '@/lib/heatmap';
import type { Device } from '@/lib/types';
import { LAB_CLICKS, LAB_EVENTS, LAB_HEATMAP_PAGE, LAB_OVERVIEW } from './fixtures';

function Specimen({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <span className="text-xs text-ink-3">{note}</span>}
      </div>
      {children}
    </div>
  );
}

const devices: Device[] = ['desktop', 'tablet', 'mobile'];
const layout = layoutClicks(LAB_CLICKS, 'desktop');
const labFilters: Filters = { range: 'all', devices: [...ALL_DEVICES], params: { browsers: 'Chrome', min_duration: '10' } };
const defNamed = (id: string) => FILTER_DEFS.find((def) => def.id === id)!;
const noop = () => {};

/** Building blocks with sample data, in every state worth looking at. */
export default function ComponentsSection() {
  return (
    <section aria-labelledby="components" className="space-y-4">
      <h2 id="components" className="text-lg font-semibold">Components</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen title="Brand">
          <div className="flex items-center gap-6">
            <Logo />
            <LogoMark className="size-10" />
            <LogoMark className="size-5" />
          </div>
        </Specimen>

        <Specimen title="Toggle group" note="icon + label; disabled option">
          <div className="flex flex-wrap gap-4">
            <ToggleGroup
              label="Device"
              value="tablet"
              hrefFor={() => '#'}
              options={devices.map((device) => ({ value: device, ...DEVICE_META[device], disabled: device === 'mobile' }))}
            />
          </div>
        </Specimen>

        <Specimen title="Device labels and event badges">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {devices.map((device) => (
              <DeviceLabel key={device} device={device} />
            ))}
            <EventBadge type="page_view" />
            <EventBadge type="click" />
          </div>
        </Specimen>

        <Specimen title="Live note and pagination">
          <LiveNote />
          <Pagination page={2} limit={20} total={52} hrefFor={() => '#'} />
        </Specimen>

        <Specimen title="Loading">
          <LoadingState rows={3} />
        </Specimen>

        <Specimen title="Empty">
          <EmptyState title="No sessions yet">Open the demo site and click around.</EmptyState>
        </Specimen>

        <Specimen title="Error" note="API error, then network error">
          <div className="space-y-3">
            <ErrorState error={new ApiError(400, 'page must be a valid URL')} />
            <ErrorState error={new TypeError('Failed to fetch')} />
          </div>
        </Specimen>

        <Specimen title="Stale error" note="data shown, refresh failed">
          <ErrorState error={new TypeError('Failed to fetch')} stale />
        </Specimen>
      </div>

      <Specimen title="Filter menu and editors" note="values from the local API; choices do nothing here">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            <FilterMenu key="menu" filters={labFilters} onChange={noop} onDone={noop} />,
            <FilterEditor key="list" def={defNamed('browsers')} filters={labFilters} onChange={noop} onDone={noop} />,
            <FilterEditor key="range" def={defNamed('duration')} filters={labFilters} onChange={noop} onDone={noop} />,
          ].map((panel) => (
            <div key={panel.key} className="rounded-xl border border-line p-3 text-sm shadow-lg">
              {panel}
            </div>
          ))}
        </div>
      </Specimen>

      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen title="Segment menu" note="this browser's saved segments; choices do nothing here">
          <SegmentMenu filters={labFilters} onChange={noop} />
        </Specimen>
        <Specimen title="My watchlist" note="this browser's watchlist, live numbers">
          <Watchlist period="previous 30 days" />
        </Specimen>
      </div>

      <Specimen title="Overview" note="sample data: stat tiles with changes, sessions chart (hover it), top pages, devices">
        <OverviewContent data={LAB_OVERVIEW} period="previous 14 days" heatmapHref={() => '#'} filterHref={() => '#'} />
      </Specimen>

      <Specimen title="Overview: no previous data" note="comparison hidden, with a note">
        <OverviewContent data={{ ...LAB_OVERVIEW, previous: { ...LAB_OVERVIEW.previous!, sessions: 0 } }} period="previous 14 days" heatmapHref={() => '#'} filterHref={() => '#'} />
      </Specimen>

      <Specimen title="Journey timeline" note="sample session">
        <EventTimeline events={LAB_EVENTS} heatmapHref={() => '#'} />
      </Specimen>

      <div className="grid gap-4 lg:grid-cols-2">
        <Specimen title="Heatmap: dots" note="sample clicks on the live demo page">
          <Heatmap pageUrl={LAB_HEATMAP_PAGE} layout={layout} mode="dots" />
        </Specimen>
        <Specimen title="Heatmap: grid">
          <Heatmap pageUrl={LAB_HEATMAP_PAGE} layout={layout} mode="grid" />
        </Specimen>
      </div>
    </section>
  );
}
