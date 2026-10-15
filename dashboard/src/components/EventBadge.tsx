import type { EventType } from '@/lib/types';

// A Record, so a new event type doesn't compile until it has a badge.
const BADGES: Record<EventType, { label: string; className: string }> = {
  page_view: {
    label: 'Page view',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  },
  click: {
    label: 'Click',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  },
  // Journeys show a visit's exit in its header, not as a row; the badge is for the lab and completeness.
  page_exit: {
    label: 'Exit',
    className: 'bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300',
  },
};

export default function EventBadge({ type }: { type: EventType }) {
  const { label, className } = BADGES[type];
  return (
    <span className={`inline-block w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
