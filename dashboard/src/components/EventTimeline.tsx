import Link from 'next/link';
import EventBadge from '@/components/EventBadge';
import { describeTarget, formatDateTime, formatOffset, pathOf } from '@/lib/format';
import { groupByPageVisit, pageViewNote } from '@/lib/journey';
import type { TrackedEvent } from '@/lib/types';

function heatmapHref(event: TrackedEvent) {
  return `/heatmap?${new URLSearchParams({ page: event.page_url, device: event.device })}`;
}

function EventRow({ event, start }: { event: TrackedEvent; start: number }) {
  const detail = event.type === 'click' ? describeTarget(event.target) : pageViewNote(event);
  return (
    <li className="flex items-baseline gap-3 px-4 py-2 text-sm">
      <time
        dateTime={event.timestamp}
        title={formatDateTime(event.timestamp)}
        className="w-16 shrink-0 font-mono text-xs tabular-nums text-neutral-500"
      >
        {formatOffset(Date.parse(event.timestamp) - start)}
      </time>
      <EventBadge type={event.type} />
      <span className="min-w-0 flex-1 break-words font-mono text-xs sm:truncate" title={detail}>
        {detail}
      </span>
      {event.type === 'click' && event.x !== undefined && event.y !== undefined && (
        <span className="hidden shrink-0 font-mono text-xs tabular-nums text-neutral-500 sm:inline">
          ({Math.round(event.x)}, {Math.round(event.y)})
        </span>
      )}
    </li>
  );
}

/** A session's events, oldest first, grouped into page visits. */
export default function EventTimeline({ events }: { events: TrackedEvent[] }) {
  const start = Date.parse(events[0].timestamp);

  return (
    <ol className="space-y-3">
      {groupByPageVisit(events).map((visit) => {
        const first = visit.events[0];
        const clicks = visit.events.filter((event) => event.type === 'click').length;
        return (
          <li
            key={first._id}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <h2 className="min-w-0 truncate font-mono text-sm font-medium" title={visit.page_url}>
                {pathOf(visit.page_url)}
              </h2>
              <span className="text-xs text-neutral-500">
                {clicks} {clicks === 1 ? 'click' : 'clicks'}
              </span>
              <Link
                href={heatmapHref(first)}
                className="ml-auto text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                View heatmap for this page →
              </Link>
            </div>
            <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
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
