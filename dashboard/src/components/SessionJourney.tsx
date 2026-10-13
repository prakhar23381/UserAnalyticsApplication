'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import EventTimeline from '@/components/EventTimeline';
import PageHeading from '@/components/PageHeading';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ApiError, sessionEventsUrl, useApi } from '@/lib/api';
import { formatDateTime, formatDuration } from '@/lib/format';
import { sourceOf } from '@/lib/journey';
import type { SessionEvents } from '@/lib/types';

const backLink = (
  <Link href="/sessions" className="mb-4 inline-block text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
    ← All sessions
  </Link>
);

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

export default function SessionJourney({ id }: { id: string }) {
  // Polls like the list, so a session still in progress grows on screen.
  const { data, error } = useApi<SessionEvents>(sessionEventsUrl(id));

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

  const { events } = data;
  const first = events[0];
  const last = events[events.length - 1];
  const pages = new Set(events.map((event) => event.page_url)).size;

  return (
    <>
      {backLink}
      <PageHeading title="User journey">
        <span className="break-all font-mono">{data.session_id}</span>
      </PageHeading>
      {error && <ErrorState error={error} stale />}
      <dl className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm sm:grid-cols-3 lg:grid-cols-6 dark:border-neutral-800 dark:bg-neutral-900">
        <Fact label="Started">{formatDateTime(first.timestamp)}</Fact>
        <Fact label="Duration">{formatDuration(Date.parse(last.timestamp) - Date.parse(first.timestamp))}</Fact>
        <Fact label="Events">{events.length}</Fact>
        <Fact label="Pages">{pages}</Fact>
        <Fact label="Device">
          <span className="capitalize">{first.device}</span>{' '}
          <span className="font-normal text-neutral-500">
            {first.viewport_w}×{first.viewport_h}
          </span>
        </Fact>
        <Fact label="Source">{sourceOf(first)}</Fact>
      </dl>
      <EventTimeline events={events} />
    </>
  );
}
