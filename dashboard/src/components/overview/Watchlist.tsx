'use client';

import { Eye, EyeOff, Flame } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DeltaText } from '@/components/overview/StatTile';
import { overviewUrl, pagesUrl, useApi } from '@/lib/api';
import { apiFilterParams, readFilters } from '@/lib/filters';
import { pathOf } from '@/lib/format';
import { useApiFilters, useDashboardHref, useFilters, useNow } from '@/lib/navigation';
import { formatCount, periodDelta } from '@/lib/overview';
import { applySegment, liveWatchItems, type SavedSegment, toggleWatch, type WatchItem } from '@/lib/segments';
import { useSavedSegments, useWatchlist } from '@/lib/storage';
import type { OverviewResponse, PagesResponse } from '@/lib/types';

/** One request per watched segment, so these refresh less often than the rest. */
const WATCH_POLL_MS = 30_000;

/** Sessions per day as a thin line. Decorative: the row says the numbers in words. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="h-6 w-24" />;
  const max = Math.max(1, ...values);
  const points = values.map((value, i) => `${(i / (values.length - 1)) * 100},${22 - (value / max) * 20}`).join(' ');
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-24 shrink-0" aria-hidden="true">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Unwatch({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink">
      <EyeOff className="size-3.5" aria-hidden="true" />
      Unwatch
      <span className="sr-only"> {label}</span>
    </button>
  );
}

/** A watched segment over the current date range: sessions, change, trend. */
function SegmentRow({ segment, period, onUnwatch }: { segment: SavedSegment; period: string | null; onUnwatch: () => void }) {
  const router = useRouter();
  const hrefFor = useDashboardHref();
  const { range } = useFilters();
  const now = useNow();
  const params = apiFilterParams(readFilters(new URLSearchParams(`${segment.query}&range=${range}`)), now);
  const { data } = useApi<OverviewResponse>(overviewUrl(params), { refreshInterval: WATCH_POLL_MS, keepPreviousData: true });
  const previous = data?.previous && data.previous.sessions > 0 ? data.previous.sessions : null;
  const delta = data ? periodDelta(data.totals.sessions, previous, { kind: 'relative', upIsGood: true }) : null;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
      <button
        type="button"
        onClick={() => router.push(hrefFor(applySegment(segment.query)), { scroll: false })}
        className="min-w-0 flex-1 truncate text-left font-medium text-accent hover:underline"
        title="Show this segment"
      >
        {segment.name}
      </button>
      <span className="tabular-nums">{data ? `${formatCount(data.totals.sessions)} sessions` : '…'}</span>
      {delta && <DeltaText delta={delta} period={period ?? undefined} className="w-16" />}
      <Sparkline values={data?.series.map((day) => day.sessions) ?? []} />
      <Unwatch label={segment.name} onClick={onUnwatch} />
    </li>
  );
}

/**
 * My watchlist: segments and pages pinned in this browser, with their numbers
 * for the current date range (segments) or the current segment (pages).
 */
export default function Watchlist({ period }: { period: string | null }) {
  const hrefFor = useDashboardHref();
  const [segments] = useSavedSegments();
  const [stored, setWatchlist] = useWatchlist();
  const items = liveWatchItems(stored, segments);
  const pageItems = items.filter((item): item is Extract<WatchItem, { kind: 'page' }> => item.kind === 'page');
  const apiFilters = useApiFilters();
  const pages = useApi<PagesResponse>(pageItems.length > 0 ? pagesUrl(apiFilters) : null, { refreshInterval: WATCH_POLL_MS });
  const unwatch = (item: WatchItem) => setWatchlist(toggleWatch(stored, item));

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <h2 className="mb-1 inline-flex items-center gap-2 text-sm font-semibold">
        <Eye className="size-4 text-ink-3" aria-hidden="true" />
        My watchlist
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-3">
          Watch a saved segment from the Segment menu, or a page from Top pages or the heatmap toolbar, to follow it here.
          Your watchlist stays in this browser.
        </p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {items.map((item) => {
            if (item.kind === 'segment') {
              const segment = segments.find((s) => s.id === item.id)!;
              return <SegmentRow key={`s:${item.id}`} segment={segment} period={period} onUnwatch={() => unwatch(item)} />;
            }
            const row = pages.data?.data.find((page) => page.page_url === item.page_url);
            return (
              <li key={`p:${item.page_url}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={item.page_url}>
                  {pathOf(item.page_url)}
                </span>
                <span className="tabular-nums text-ink-2">
                  {pages.data ? `${(row?.page_views ?? 0).toLocaleString('en')} views · ${(row?.clicks ?? 0).toLocaleString('en')} clicks` : '…'}
                </span>
                <Link
                  href={hrefFor({ tab: 'heatmaps', page: item.page_url })}
                  scroll={false}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  <Flame className="size-3.5" aria-hidden="true" />
                  Heatmap
                </Link>
                <Unwatch label={pathOf(item.page_url)} onClick={() => unwatch(item)} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
