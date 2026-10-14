import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { Delta } from '@/lib/overview';

const TONE: Record<Delta['tone'], string> = {
  good: 'text-delta-good',
  bad: 'text-delta-bad',
  neutral: 'text-ink-3',
};
const ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/** A change from the previous period: arrow, words and colour, so it never relies on colour alone. */
export function DeltaText({ delta, period, className = '' }: { delta: Delta; period?: string; className?: string }) {
  const Icon = ICON[delta.direction];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${TONE[delta.tone]} ${className}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {delta.text}
      {period && <span className="sr-only">vs the {period}</span>}
    </span>
  );
}

/**
 * One headline number. The change from the previous period carries an arrow
 * and words as well as colour, so it never relies on colour alone.
 */
export default function StatTile({ label, value, delta, period }: { label: string; value: string; delta: Delta | null; period?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
      <p className="text-xs font-medium text-ink-3">{label}</p>
      {/* Proportional figures read better than tabular ones at this size. */}
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {delta && (
        // The period is named once above the tiles; screen readers get it here too.
        <p className="mt-1">
          <DeltaText delta={delta} period={period} />
        </p>
      )}
    </div>
  );
}
