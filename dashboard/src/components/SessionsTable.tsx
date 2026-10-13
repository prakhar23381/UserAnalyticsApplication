'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Pagination from '@/components/Pagination';
import RelativeTime from '@/components/RelativeTime';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { DEMO_URL, POLL_MS, sessionsUrl, useApi } from '@/lib/api';
import { formatDuration, pathOf, shortId } from '@/lib/format';
import type { Paginated, SessionSummary } from '@/lib/types';

const pageHref = (page: number) => (page > 1 ? `/sessions?page=${page}` : '/sessions');

function pageParam(value: string | null): number {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isNaN(page) || page < 1 ? 1 : page;
}

const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function SessionsTable() {
  const router = useRouter();
  const page = pageParam(useSearchParams().get('page'));
  // keepPreviousData: the current rows stay while the next page loads.
  const { data, error } = useApi<Paginated<SessionSummary>>(sessionsUrl(page), { keepPreviousData: true });

  if (!data) return error ? <ErrorState error={error} /> : <LoadingState rows={8} />;

  if (data.total === 0) {
    return (
      <EmptyState title="No sessions yet">
        Open the{' '}
        <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline dark:text-indigo-400">
          demo site
        </a>{' '}
        and click around. Sessions show up here within a few seconds.
      </EmptyState>
    );
  }

  if (data.data.length === 0) {
    return (
      <EmptyState title={`There's no page ${data.page}`}>
        <Link href={pageHref(1)} className="text-indigo-600 underline dark:text-indigo-400">
          Go to the first page
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      {error && <ErrorState error={error} stale />}
      <p className="mb-3 flex items-center gap-2 text-xs text-neutral-500">
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
        Live: refreshes every {POLL_MS / 1000} s
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
            <tr>
              <th scope="col" className={th}>Session</th>
              <th scope="col" className={`${th} text-right`}>Events</th>
              <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Page views</th>
              <th scope="col" className={`${th} hidden text-right sm:table-cell`}>Clicks</th>
              <th scope="col" className={`${th} hidden md:table-cell`}>Device</th>
              <th scope="col" className={th}>Started</th>
              <th scope="col" className={`${th} hidden md:table-cell`}>Duration</th>
              <th scope="col" className={`${th} hidden lg:table-cell`}>Entry page</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.data.map((session) => {
              const href = `/sessions/${encodeURIComponent(session.session_id)}`;
              return (
                <tr
                  key={session.session_id}
                  // The whole row opens the journey; the id stays a real link for keyboards and new tabs.
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest('a')) router.push(href);
                  }}
                  className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                >
                  <td className={td}>
                    <Link href={href} title={session.session_id} className="font-mono text-indigo-600 hover:underline dark:text-indigo-400">
                      {shortId(session.session_id)}
                    </Link>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{session.event_count}</td>
                  <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{session.page_views}</td>
                  <td className={`${td} hidden text-right tabular-nums sm:table-cell`}>{session.clicks}</td>
                  <td className={`${td} hidden capitalize md:table-cell`}>{session.device}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <RelativeTime iso={session.first_seen} />
                  </td>
                  <td className={`${td} hidden tabular-nums md:table-cell`}>{formatDuration(session.duration_ms)}</td>
                  <td className={`${td} hidden max-w-56 truncate font-mono text-xs lg:table-cell`} title={session.entry_page}>
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
