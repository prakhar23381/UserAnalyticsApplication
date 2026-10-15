'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import DeviceLabel from '@/components/DeviceLabel';
import EventTimeline from '@/components/EventTimeline';
import InsightChip from '@/components/InsightChip';
import PageHeading from '@/components/PageHeading';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ApiError, sessionEventsUrl, useApi } from '@/lib/api';
import { countryName } from '@/lib/filters';
import { formatDateTime, formatDuration } from '@/lib/format';
import { sessionInsights } from '@/lib/insights';
import { sourceOf } from '@/lib/journey';
import { useDashboardHref } from '@/lib/navigation';
import type { SessionEvents, TrackedEvent } from '@/lib/types';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-ink-3">{label}</dt>
      <dd className="mt-1 truncate font-medium">{children}</dd>
    </div>
  );
}

export default function SessionJourney({ id }: { id: string }) {
  const hrefFor = useDashboardHref();
  // Polls like the list, so a session still in progress grows on screen.
  const { data, error } = useApi<SessionEvents>(sessionEventsUrl(id));

  const backLink = (
    <Link
      href={hrefFor({ session: null })}
      scroll={false}
      className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-3 hover:text-ink"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All sessions
    </Link>
  );
  const heatmapHref = (event: TrackedEvent) => hrefFor({ tab: 'heatmaps', page: event.page_url, device: event.device });

  if (!data) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return (
        <>
          {backLink}
          <EmptyState title="Session not found">
            No events were recorded under <span className="font-mono">{id}</span>.
          </EmptyState>
        </>
      );
    }
    return (
      <>
        {backLink}
        {error ? <ErrorState error={error} /> : <LoadingState />}
      </>
    );
  }

  const { events, session } = data;
  const first = events[0];
  const last = events[events.length - 1];
  const pages = new Set(events.map((event) => event.page_url)).size;
  const insights = session ? sessionInsights(session) : [];

  return (
    <>
      {backLink}
      <PageHeading title="User journey">
        <span className="break-all font-mono">{data.session_id}</span>
      </PageHeading>
      {error && <ErrorState error={error} stale />}
      <dl className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-line bg-surface p-4 text-sm shadow-xs sm:grid-cols-4">
        <Fact label="Started">{formatDateTime(first.timestamp)}</Fact>
        <Fact label="Duration">{formatDuration(Date.parse(last.timestamp) - Date.parse(first.timestamp))}</Fact>
        {/* Page views and clicks, as the sessions list counts them; page exits only carry totals. */}
        <Fact label="Events">{events.filter((event) => event.type !== 'page_exit').length}</Fact>
        <Fact label="Pages">{pages}</Fact>
        <Fact label="Device">
          <DeviceLabel device={first.device} />{' '}
          <span className="font-normal text-ink-3">
            {first.viewport_w}×{first.viewport_h}
          </span>
        </Fact>
        <Fact label="Browser">
          {session ? (
            <>
              {session.browser} <span className="font-normal text-ink-3">on {session.os}</span>
            </>
          ) : (
            '—'
          )}
        </Fact>
        <Fact label="Country">{session?.country ? countryName(session.country) : 'Unknown'}</Fact>
        <Fact label="Source">{session?.source ?? sourceOf(first)}</Fact>
        {insights.length > 0 && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs font-medium text-ink-3">Insights</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {insights.map(({ insight, count }) => (
                <InsightChip key={insight} insight={insight} count={count} />
              ))}
            </dd>
          </div>
        )}
      </dl>
      <EventTimeline events={events} heatmapHref={heatmapHref} />
    </>
  );
}
