import { Flame } from 'lucide-react';
import Link from 'next/link';
import EventBadge from '@/components/EventBadge';
import InsightChip from '@/components/InsightChip';
import { describeTarget, formatDateTime, formatDuration, formatOffset, pathOf } from '@/lib/format';
import { eventInsights } from '@/lib/insights';
import { groupByPageVisit, pageViewNote, visitEngagement } from '@/lib/journey';
import type { TrackedEvent } from '@/lib/types';

function EventRow({ event, start }: { event: TrackedEvent; start: number }) {
  const detail = event.type === 'click' ? describeTarget(event.target) : pageViewNote(event);
  return (
    <li className="flex items-baseline gap-3 px-4 py-2 text-sm">
      <time
        dateTime={event.timestamp}
        title={formatDateTime(event.timestamp)}
        className="w-16 shrink-0 font-mono text-xs tabular-nums text-ink-3"
      >
        {formatOffset(Date.parse(event.timestamp) - start)}
      </time>
      <EventBadge type={event.type} />
      <span className="min-w-0 flex-1 break-words font-mono text-xs text-ink-2 sm:truncate" title={detail}>
        {detail}
      </span>
      {eventInsights(event).map((insight) => (
        <InsightChip key={insight} insight={insight} />
      ))}
      {event.type === 'click' && event.x !== undefined && event.y !== undefined && (
        <span className="hidden shrink-0 font-mono text-xs tabular-nums text-ink-3 sm:inline">
          ({Math.round(event.x)}, {Math.round(event.y)})
        </span>
      )}
    </li>
  );
}

/** A session's events, oldest first, grouped into page visits. */
export default function EventTimeline({
  events,
  heatmapHref,
}: {
  events: TrackedEvent[];
  heatmapHref: (event: TrackedEvent) => string;
}) {
  const start = Date.parse(events[0].timestamp);

  return (
    <ol className="space-y-3">
      {groupByPageVisit(events).map((visit) => {
        const first = visit.events[0];
        const clicks = visit.events.filter((event) => event.type === 'click').length;
        const engagement = visitEngagement(visit, formatDuration);
        return (
          <li key={first._id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2 px-4 py-2.5">
              <h2 className="min-w-0 truncate font-mono text-sm font-medium" title={visit.page_url}>
                {pathOf(visit.page_url)}
              </h2>
              <span className="text-xs text-ink-3">
                {clicks} {clicks === 1 ? 'click' : 'clicks'}
              </span>
              {engagement && <span className="text-xs text-ink-3">· {engagement}</span>}
              {visit.exit?.excessive_scroll && <InsightChip insight="excessive_scroll" />}
              <Link
                href={heatmapHref(first)}
                scroll={false}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <Flame className="size-3.5" aria-hidden="true" />
                Heatmap for this page
              </Link>
            </div>
            <ol className="divide-y divide-line">
              {visit.events.map((event) => (
                <EventRow key={event._id} event={event} start={start} />
              ))}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}
