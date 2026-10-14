'use client';

import { Calendar, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DEVICE_META } from '@/components/DeviceLabel';
import { ALL_DEVICES, devicesParam, RANGES, rangeParam, toggleDevice } from '@/lib/filters';
import { useDashboardHref, useFilters } from '@/lib/navigation';

/**
 * The segment: one row of filters above the tabs, scoping all of them. State
 * lives in the URL (?range=, ?devices=); changing it sends the sessions list
 * back to its first page.
 */
export default function FilterBar() {
  const router = useRouter();
  const hrefFor = useDashboardHref();
  const { range, devices } = useFilters();
  const go = (changes: Parameters<typeof hrefFor>[0]) => router.push(hrefFor({ ...changes, p: null }), { scroll: false });

  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? '';
  const rangeSummary = range === 'all' ? 'All sessions' : `Sessions that started in the ${rangeLabel.toLowerCase()}`;
  const deviceSummary =
    devices.length === ALL_DEVICES.length ? 'all devices' : devices.map((d) => DEVICE_META[d].label.toLowerCase()).join(' and ');

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 text-sm">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Segment
      </span>

      <label className="inline-flex items-center gap-2">
        <span className="sr-only">Date range</span>
        <span className="relative inline-flex items-center">
          <Calendar className="pointer-events-none absolute left-2.5 size-4 text-ink-3" aria-hidden="true" />
          <select
            value={range}
            onChange={(event) => go({ range: rangeParam(event.target.value as typeof range) })}
            className="rounded-lg border border-line bg-surface py-1.5 pr-8 pl-8 font-medium shadow-xs"
          >
            {RANGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>
      </label>

      <div role="group" aria-label="Devices" className="inline-flex flex-wrap gap-1.5">
        {ALL_DEVICES.map((device) => {
          const { label, icon: Icon } = DEVICE_META[device];
          const on = devices.includes(device);
          const onlyOne = on && devices.length === 1;
          return (
            <button
              key={device}
              type="button"
              aria-pressed={on}
              disabled={onlyOne}
              title={onlyOne ? 'At least one device stays selected' : undefined}
              onClick={() => go({ devices: devicesParam(toggleDevice(devices, device)) })}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium disabled:cursor-not-allowed ${
                on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-3 sm:ml-auto">
        {rangeSummary} · {deviceSummary}
      </p>
    </div>
  );
}
