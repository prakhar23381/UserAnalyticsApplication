import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Delta } from '@/lib/overview';

const TONE: Record<Delta['tone'], string> = {
  good: 'text-delta-good',
  bad: 'text-delta-bad',
  neutral: 'text-ink-3',
};
const ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/**
 * One headline number. The change from the previous period carries an arrow
 * and words as well as colour, so it never relies on colour alone.
 */
export default function StatTile({ label, value, delta, period }: { label: string; value: string; delta: Delta | null; period?: string }) {
  const Icon = delta ? ICON[delta.direction] : null;
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      {/* Proportional figures read better than tabular ones at this size. */}
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {delta && Icon && (
        // The period is named once above the tiles; screen readers get it here too.
        <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${TONE[delta.tone]}`}>
          <Icon className="size-3.5 shrink-0" aria-hidden="true" />
          {delta.text}
          {period && <span className="sr-only">vs the {period}</span>}
        </p>
      )}
    </div>
  );
}
