'use client';

import { Calendar, ChevronDown, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DEVICE_META } from '@/components/DeviceLabel';
import { FilterEditor, FilterMenu } from '@/components/FilterEditor';
import Popover from '@/components/Popover';
import {
  ALL_DEVICES,
  activeFilters,
  clearAllFilters,
  clearFilter,
  devicesParam,
  filterSummary,
  RANGES,
  rangeParam,
  toggleDevice,
} from '@/lib/filters';
import { useDashboardHref, useFilters } from '@/lib/navigation';
import type { Changes } from '@/lib/url';

const control = 'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium';

/**
 * The segment: the filters above the tabs, scoping all of them. State lives in
 * the URL (?range=, ?devices=, ?browsers=, …); changing it sends the sessions
 * list back to its first page.
 */
export default function FilterBar() {
  const router = useRouter();
  const hrefFor = useDashboardHref();
  const filters = useFilters();
  const { range, devices } = filters;
  const go = (changes: Changes) => router.push(hrefFor({ ...changes, p: null }), { scroll: false });

  const active = activeFilters(filters);
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? '';
  const rangeSummary = range === 'all' ? 'All sessions' : `Sessions that started in the ${rangeLabel.toLowerCase()}`;
  const deviceSummary =
    devices.length === ALL_DEVICES.length ? 'all devices' : devices.map((d) => DEVICE_META[d].label.toLowerCase()).join(' and ');
  const filterCount = active.length > 0 ? ` · ${active.length} more ${active.length === 1 ? 'filter' : 'filters'}` : '';

  return (
    <div className="space-y-2.5 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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
                className={`${control} disabled:cursor-not-allowed ${
                  on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>

        <Popover
          label="Add a filter"
          buttonClassName={`${control} border-dashed border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink`}
          button={
            <>
              <Plus className="size-4" aria-hidden="true" />
              Filter
            </>
          }
        >
          {(close) => <FilterMenu filters={filters} onChange={go} onDone={close} />}
        </Popover>

        <p className="text-xs text-ink-3 sm:ml-auto">
          {rangeSummary} · {deviceSummary}
          {filterCount}
        </p>
      </div>

      {active.length > 0 && (
        <ul aria-label="Filters in the segment" className="flex flex-wrap items-center gap-2">
          {active.map((def) => (
            <li key={def.id} className="inline-flex items-stretch rounded-lg border border-accent bg-accent-soft text-accent-ink">
              <Popover
                label={`Edit the ${def.label.toLowerCase()} filter`}
                buttonClassName="inline-flex max-w-72 items-center gap-1 py-1 pr-1 pl-2.5 text-left"
                button={
                  <>
                    <span className="truncate">
                      <span className="font-medium">{def.label}:</span> {filterSummary(def, filters)}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
                  </>
                }
              >
                {(close) => <FilterEditor def={def} filters={filters} onChange={go} onDone={close} />}
              </Popover>
              <button
                type="button"
                onClick={() => go(clearFilter(def))}
                className="rounded-r-lg border-l border-accent/30 px-1.5 hover:bg-accent/10"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Remove the {def.label.toLowerCase()} filter</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => go(clearAllFilters())} className="px-1.5 text-xs font-medium text-ink-3 hover:text-ink">
              Clear all
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
