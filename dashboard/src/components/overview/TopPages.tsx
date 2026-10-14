import { Flame } from 'lucide-react';
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
}: {
  pages: OverviewResponse['top_pages'];
  heatmapHref: (pageUrl: string) => string;
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
          </div>
          <div className="mt-1.5 h-1.5 rounded-r bg-accent" style={{ width: `${(page.page_views / max) * 100}%` }} aria-hidden="true" />
        </li>
      ))}
    </ol>
  );
}
