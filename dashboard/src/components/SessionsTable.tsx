'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DeviceLabel from '@/components/DeviceLabel';
import InsightChip from '@/components/InsightChip';
import Pagination from '@/components/Pagination';
import RelativeTime from '@/components/RelativeTime';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { DEMO_URL, POLL_MS, sessionsUrl, useApi } from '@/lib/api';
import { formatDuration, pathOf, shortId } from '@/lib/format';
import { countryName, isNarrowed } from '@/lib/filters';
import { sessionInsights } from '@/lib/insights';
import { useApiFilters, useDashboardHref, useFilters } from '@/lib/navigation';
import type { Paginated, SessionSummary } from '@/lib/types';
import { parsePageNumber } from '@/lib/url';

const th = 'px-4 py-2.5 text-xs font-medium text-ink-3';
const td = 'px-4 py-3';

/** Live dot + polling note, shown above lists that refresh themselves. */
export function LiveNote() {
  return (
    <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-3">
      <span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
      Live: refreshes every {POLL_MS / 1000} s
    </p>
  );
}

export default function SessionsTable() {
  const router = useRouter();
  const hrefFor = useDashboardHref();
  const page = parsePageNumber(useSearchParams().get('p'));
  const pageHref = (n: number) => hrefFor({ p: n > 1 ? n : null });
  const filters = useFilters();
  const narrowed = isNarrowed(filters);
  // keepPreviousData: the current rows stay while the next page (or segment) loads.
  const { data, error } = useApi<Paginated<SessionSummary>>(sessionsUrl(page, useApiFilters()), { keepPreviousData: true });

  if (!data) return error ? <ErrorState error={error} /> : <LoadingState rows={8} />;

  if (data.total === 0 && narrowed) {
    return (
      <EmptyState title="No sessions in this segment">
        Try a longer date range, more devices or fewer filters in the filter bar.
      </EmptyState>
    );
  }

  if (data.total === 0) {
    return (
      <EmptyState title="No sessions yet">
        Open the{' '}
        <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline">
          demo site
        </a>{' '}
        and click around. Sessions show up here within a few seconds.
      </EmptyState>
    );
  }

  if (data.data.length === 0) {
    return (
      <EmptyState title={`There's no page ${data.page}`}>
        <Link href={pageHref(1)} className="font-medium text-accent underline">
          Go to the first page
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      {error && <ErrorState error={error} stale />}
      <LiveNote />
      <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface-2">
            <tr>
              <th scope="col" className={th}>Session</th>
              <th scope="col" className={`${th} text-right`}>Events</th>
              <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Page views</th>
              <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Clicks</th>
              <th scope="col" className={`${th} hidden md:table-cell`}>Insights</th>
              <th scope="col" className={`${th} hidden md:table-cell`}>Device</th>
              <th scope="col" className={`${th} hidden lg:table-cell`}>Browser</th>
              <th scope="col" className={`${th} hidden xl:table-cell`}>Country</th>
              <th scope="col" className={`${th} hidden xl:table-cell`}>Source</th>
              <th scope="col" className={th}>Started</th>
              <th scope="col" className={`${th} hidden md:table-cell`}>Duration</th>
              <th scope="col" className={`${th} hidden lg:table-cell`}>Entry page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.data.map((session) => {
              const href = hrefFor({ session: session.session_id });
              return (
                <tr
                  key={session.session_id}
                  // The whole row opens the journey; the id stays a real link for keyboards and new tabs.
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest('a')) router.push(href, { scroll: false });
                  }}
                  className="cursor-pointer hover:bg-surface-2"
                >
                  <td className={td}>
                    <Link href={href} scroll={false} title={session.session_id} className="font-mono font-medium text-accent hover:underline">
                      {shortId(session.session_id)}
                    </Link>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{session.event_count}</td>
                  <td className={`${td} hidden text-right tabular-nums text-ink-2 sm:table-cell`}>{session.page_views}</td>
                  <td className={`${td} hidden text-right tabular-nums text-ink-2 sm:table-cell`}>{session.clicks}</td>
                  <td className={`${td} hidden md:table-cell`}>
                    <div className="flex flex-wrap gap-1">
                      {sessionInsights(session).map(({ insight, count }) => (
                        <InsightChip key={insight} insight={insight} count={count} />
                      ))}
                    </div>
                  </td>
                  <td className={`${td} hidden md:table-cell`}>
                    <DeviceLabel device={session.device} />
                  </td>
                  <td className={`${td} hidden whitespace-nowrap text-ink-2 lg:table-cell`} title={session.os}>
                    {session.browser}
                  </td>
                  <td className={`${td} hidden max-w-36 truncate text-ink-2 xl:table-cell`}>
                    {session.country ? countryName(session.country) : <span className="text-ink-3">Unknown</span>}
                  </td>
                  <td className={`${td} hidden max-w-36 truncate text-ink-2 xl:table-cell`} title={session.source}>
                    {session.source}
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>
                    <RelativeTime iso={session.first_seen} />
                  </td>
                  <td className={`${td} hidden tabular-nums text-ink-2 md:table-cell`}>{formatDuration(session.duration_ms)}</td>
                  <td className={`${td} hidden max-w-56 truncate font-mono text-xs text-ink-2 lg:table-cell`} title={session.entry_page}>
                    {pathOf(session.entry_page)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={data.page} limit={data.limit} total={data.total} hrefFor={pageHref} />
    </>
  );
}
