import { Filter } from 'lucide-react';
import Link from 'next/link';

export interface ValueBar {
  key: string;
  label: string;
  sessions: number;
  /** Narrows the segment to this value, when there's a filter for it. */
  filterHref?: string;
}

/**
 * Sessions per value of one attribute (browser, country, source): one series,
 * so one colour; bars share a baseline and each row carries its count and share
 * as text. Shares are of all the segment's sessions, so a top-five list can sum
 * to less than 100%.
 */
export default function ValueBars({ rows, total, filterLabel }: { rows: ValueBar[]; total: number; filterLabel?: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-3">Nothing recorded for these sessions.</p>;
  const max = Math.max(1, ...rows.map((row) => row.sessions));
  return (
    <ol className="space-y-3 text-sm">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 truncate" title={row.label}>
              {row.label}
            </span>
            <span className="tabular-nums text-ink-2">{row.sessions.toLocaleString('en')}</span>
            <span className="w-10 text-right tabular-nums text-ink-3">{total > 0 ? Math.round((row.sessions / total) * 100) : 0}%</span>
            {row.filterHref && (
              <Link
                href={row.filterHref}
                scroll={false}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Filter className="size-3.5" aria-hidden="true" />
                {filterLabel ?? 'Filter'}
                <span className="sr-only"> to {row.label}</span>
              </Link>
            )}
          </div>
          <div className="mt-1.5 h-1.5 rounded-r bg-accent" style={{ width: `${(row.sessions / max) * 100}%` }} aria-hidden="true" />
        </li>
      ))}
    </ol>
  );
}
