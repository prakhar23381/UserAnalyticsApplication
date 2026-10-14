import { Angry, type LucideIcon, MousePointerBan, Undo2 } from 'lucide-react';
import { type Insight, INSIGHT_INFO } from '@/lib/insights';

// A Record, so a new insight doesn't compile until it has an icon and colours.
export const INSIGHT_STYLE: Record<Insight, { icon: LucideIcon; className: string }> = {
  rage: { icon: Angry, className: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300' },
  dead: { icon: MousePointerBan, className: 'bg-slate-200 text-slate-800 dark:bg-slate-500/20 dark:text-slate-300' },
  quick_back: { icon: Undo2, className: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300' },
};

/** An insight as a small chip: icon and words, never colour alone. With `count`, "3 dead clicks". */
export default function InsightChip({ insight, count }: { insight: Insight; count?: number }) {
  const { icon: Icon, className } = INSIGHT_STYLE[insight];
  const { label, one, description } = INSIGHT_INFO[insight];
  const text = count === undefined ? one : `${count} ${(count === 1 ? one : label).toLowerCase()}`;
  return (
    <span
      title={description}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {text}
    </span>
  );
}
