'use client';

import { Table } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  type TooltipValueType,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCount, formatDay } from '@/lib/overview';
import type { OverviewResponse } from '@/lib/types';

type Series = OverviewResponse['series'];

// Chart chrome follows the design tokens, so light and dark need no extra code.
const AXIS_TICK = { fill: 'var(--ink-3)', fontSize: 12 };

// Recharts' own value and name types (its NameType, number | string, isn't exported).
function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, number | string>) {
  if (!active || !payload?.length) return null;
  const sessions = Number(payload[0].value ?? 0);
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      {/* The value leads; the date follows. */}
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-0.5 w-3 rounded-full bg-accent" aria-hidden="true" />
        {formatCount(sessions)} {sessions === 1 ? 'session' : 'sessions'}
      </p>
      <p className="mt-0.5 text-ink-3">{formatDay(String(label), true)}</p>
    </div>
  );
}

/**
 * Sessions per day: one series, so a 2 px line over a 10% wash, no legend (the
 * card title names it), a crosshair tooltip, and a table view of the same numbers.
 */
export default function SessionsChart({ series }: { series: Series }) {
  return (
    <>
      <div className="h-64" role="img" aria-label={`Sessions per day, ${series.length} days. A table of the same numbers follows.`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="date"
              tickFormatter={(day: string) => formatDay(day)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tickFormatter={(value: number) => formatCount(value)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={ChartTooltip} cursor={{ stroke: 'var(--ink-3)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="sessions"
              stroke="var(--accent)"
              strokeWidth={2}
              fill="var(--accent)"
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink">
          <Table className="size-3.5" aria-hidden="true" />
          Show as table
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-2">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium text-ink-3">Day (UTC)</th>
                <th scope="col" className="px-3 py-2 text-right font-medium text-ink-3">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {series.map((row) => (
                <tr key={row.date}>
                  <td className="px-3 py-1.5">{formatDay(row.date, true)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.sessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
