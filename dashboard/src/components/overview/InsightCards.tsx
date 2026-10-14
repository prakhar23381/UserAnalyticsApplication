import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { INSIGHT_STYLE } from '@/components/InsightChip';
import { DeltaText } from '@/components/overview/StatTile';
import { type Insight, INSIGHT_INFO, insightShare, INSIGHTS } from '@/lib/insights';
import { formatCount, formatRate, periodDelta } from '@/lib/overview';
import type { OverviewTotals } from '@/lib/types';

/**
 * One card per insight: the share of the segment's sessions that had it, how
 * many, the change from the previous period (down is good), and a link to
 * those sessions.
 */
export default function InsightCards({
  totals,
  previous,
  period,
  sessionsHref,
}: {
  totals: OverviewTotals;
  previous: OverviewTotals | null;
  period: string | null;
  sessionsHref: (insight: Insight) => string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {INSIGHTS.map((insight) => {
        const { icon: Icon, className } = INSIGHT_STYLE[insight];
        const { label, description } = INSIGHT_INFO[insight];
        const { sessions, share } = insightShare(totals, insight);
        const delta = previous ? periodDelta(share, insightShare(previous, insight).share, { kind: 'points', upIsGood: false }) : null;
        return (
          <div key={insight} className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-xs">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-ink-3">
              <span className={`inline-flex size-6 items-center justify-center rounded-full ${className}`}>
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              {label}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">{formatRate(share)}</span>
              <span className="text-xs text-ink-3">of sessions</span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
              <span className="tabular-nums">
                {formatCount(sessions)} {sessions === 1 ? 'session' : 'sessions'}
              </span>
              {delta && <DeltaText delta={delta} period={period ?? undefined} />}
            </p>
            <p className="mt-2 text-xs text-ink-3">{description}</p>
            {sessions > 0 && (
              <Link
                href={sessionsHref(insight)}
                scroll={false}
                className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-accent hover:underline"
              >
                View sessions
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
