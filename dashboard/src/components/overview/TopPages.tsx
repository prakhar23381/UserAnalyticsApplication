import { Eye, EyeOff, Flame } from 'lucide-react';
import Link from 'next/link';
import { pathOf } from '@/lib/format';
import type { OverviewResponse } from '@/lib/types';

/**
 * Pages by page views: one series, so one colour for every bar; bars grow from
 * a shared baseline and each row carries its value as text.
 */
export default function TopPages({
  pages,
  heatmapHref,
  watch,
}: {
  pages: OverviewResponse['top_pages'];
  heatmapHref: (pageUrl: string) => string;
  /** Watching pages (the watchlist lives in the browser, so the lab leaves this out). */
  watch?: { isWatched: (pageUrl: string) => boolean; toggle: (pageUrl: string) => void };
}) {
  const max = Math.max(1, ...pages.map((page) => page.page_views));
  return (
    <ol className="space-y-3 text-sm">
      {pages.map((page) => (
        <li key={page.page_url}>
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs" title={page.page_url}>
              {pathOf(page.page_url)}
            </span>
            <span className="tabular-nums text-ink-2">{page.page_views.toLocaleString('en')}</span>
            <Link
              href={heatmapHref(page.page_url)}
              scroll={false}
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <Flame className="size-3.5" aria-hidden="true" />
              Heatmap
            </Link>
            {watch && (
              <button
                type="button"
                onClick={() => watch.toggle(page.page_url)}
                aria-pressed={watch.isWatched(page.page_url)}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
              >
                {watch.isWatched(page.page_url) ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                {watch.isWatched(page.page_url) ? 'Unwatch' : 'Watch'}
                <span className="sr-only"> {pathOf(page.page_url)}</span>
              </button>
            )}
          </div>
          <div className="mt-1.5 h-1.5 rounded-r bg-accent" style={{ width: `${(page.page_views / max) * 100}%` }} aria-hidden="true" />
        </li>
      ))}
    </ol>
  );
}
