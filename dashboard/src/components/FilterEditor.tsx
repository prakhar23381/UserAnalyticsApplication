'use client';

import { ArrowLeft, Check, ChevronRight, Search } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ErrorState } from '@/components/States';
import { filterOptionsUrl, useApi } from '@/lib/api';
import {
  clearFilter,
  FILTER_DEFS,
  FILTER_GROUPS,
  type FilterDef,
  type Filters,
  isFilterSet,
  type ListDef,
  listValues,
  type OneDef,
  optionLabel,
  type RangeDef,
  toggleListValue,
} from '@/lib/filters';
import { useApiFilters } from '@/lib/navigation';
import type { FilterOptionsResponse, ValueCount } from '@/lib/types';
import type { Changes } from '@/lib/url';

const SEARCH_FROM = 8; // a search box once a list is longer than this

/** The values a menu offers, for the current date range. Loaded only while a menu is open. */
function useFilterOptions() {
  // No polling: options moving under the pointer while choosing would be worse than slightly stale counts.
  return useApi<FilterOptionsResponse>(filterOptionsUrl(useApiFilters()), { refreshInterval: 0, revalidateOnFocus: false });
}

/** Options plus any chosen value the range no longer has, so it can still be unticked. */
function withChosen(options: ValueCount[], chosen: string[]): ValueCount[] {
  const missing = chosen.filter((value) => !options.some((option) => option.value === value));
  return [...options, ...missing.map((value) => ({ value, sessions: 0 }))];
}

function Choices({
  def,
  options,
  chosen,
  multiple,
  onPick,
}: {
  def: ListDef | OneDef;
  options: ValueCount[];
  chosen: string[];
  multiple: boolean;
  onPick: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const all = withChosen(options, chosen);
  const shown = query
    ? all.filter((option) => optionLabel(def.options, option.value).toLowerCase().includes(query.toLowerCase()))
    : all;

  if (all.length === 0) return <p className="px-1 py-2 text-ink-3">No values in this date range.</p>;
  return (
    <>
      {all.length > SEARCH_FROM && (
        <label className="relative mb-2 block">
          <span className="sr-only">Search {def.label.toLowerCase()} values</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pr-2 pl-8"
          />
        </label>
      )}
      <fieldset className="max-h-64 space-y-0.5 overflow-y-auto">
        <legend className="sr-only">{def.label}</legend>
        {shown.map((option) => {
          const on = chosen.includes(option.value);
          return (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface-2">
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={def.id}
                checked={on}
                onChange={() => onPick(option.value)}
                className="size-4 accent-[var(--accent)]"
              />
              <span className={`min-w-0 flex-1 truncate ${def.kind === 'one' && def.param.endsWith('_page') ? 'font-mono text-xs' : ''}`} title={option.value}>
                {optionLabel(def.options, option.value)}
              </span>
              <span className="tabular-nums text-xs text-ink-3">{option.sessions.toLocaleString('en')}</span>
            </label>
          );
        })}
        {shown.length === 0 && <p className="px-1 py-2 text-ink-3">Nothing matches “{query}”.</p>}
      </fieldset>
    </>
  );
}

function RangeForm({ def, filters, onChange }: { def: RangeDef; filters: Filters; onChange: (changes: Changes) => void }) {
  const [min, setMin] = useState(filters.params[def.min] ?? '');
  const [max, setMax] = useState(filters.params[def.max] ?? '');
  const unit = def.unit === 'seconds' ? 'seconds' : def.id === 'pages' ? 'page views' : 'clicks';
  const invalid = min !== '' && max !== '' && Number(min) > Number(max);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!invalid) onChange({ [def.min]: min || null, [def.max]: max || null });
  };
  const field = (label: string, value: string, set: (value: string) => void) => (
    <label className="block flex-1">
      <span className="mb-1 block text-xs font-medium text-ink-3">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(event) => set(event.target.value.replace(/\D/g, ''))}
        className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 tabular-nums"
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-3">
        {field('At least', min, setMin)}
        {field('At most', max, setMax)}
      </div>
      <p className={`text-xs ${invalid ? 'text-[var(--delta-bad)]' : 'text-ink-3'}`}>
        {invalid ? '“At least” is more than “at most”.' : `In ${unit}; leave either side empty.`}
      </p>
      <button
        type="submit"
        disabled={invalid}
        className="w-full rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Apply
      </button>
    </form>
  );
}

/** Changes one filter. Lists and single values apply as they're picked; a range applies with its button. */
export function FilterEditor({
  def,
  filters,
  onChange,
  onBack,
  onDone,
}: {
  def: FilterDef;
  filters: Filters;
  onChange: (changes: Changes) => void;
  onBack?: () => void;
  onDone: () => void;
}) {
  const options = useFilterOptions();
  const isSet = isFilterSet(def, filters);
  const back = useRef<HTMLButtonElement>(null);
  // Opened from the menu, the item that was clicked is gone: keep focus inside, on the way back.
  useEffect(() => back.current?.focus(), []);

  let body;
  if (def.kind === 'range') {
    body = (
      <RangeForm
        def={def}
        filters={filters}
        onChange={(changes) => {
          onChange(changes);
          onDone();
        }}
      />
    );
  } else if (options.error) {
    body = <ErrorState error={options.error} />;
  } else if (!options.data) {
    body = <div className="h-24 animate-pulse rounded-lg bg-surface-2" />;
  } else if (def.kind === 'list') {
    body = (
      <Choices
        def={def}
        options={options.data[def.options]}
        chosen={listValues(filters, def.param)}
        multiple
        onPick={(value) => onChange({ [def.param]: toggleListValue(filters, def.param, value) })}
      />
    );
  } else {
    const chosen = filters.params[def.param];
    body = (
      <Choices
        def={def}
        options={options.data[def.options]}
        chosen={chosen ? [chosen] : []}
        multiple={false}
        onPick={(value) => {
          onChange({ [def.param]: value });
          onDone();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {onBack && (
          <button ref={back} type="button" onClick={onBack} className="rounded-md p-1 text-ink-3 hover:bg-surface-2 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">All filters</span>
          </button>
        )}
        <h3 className="flex-1 font-semibold">{def.label}</h3>
        {isSet && (
          <button
            type="button"
            onClick={() => {
              onChange(clearFilter(def));
              onDone();
            }}
            className="text-xs font-medium text-ink-3 hover:text-ink"
          >
            Remove
          </button>
        )}
      </div>
      {body}
    </div>
  );
}

/** The "+ Filter" menu: every filter by group; picking one opens its editor in place. */
export function FilterMenu({ filters, onChange, onDone }: { filters: Filters; onChange: (changes: Changes) => void; onDone: () => void }) {
  const [editing, setEditing] = useState<FilterDef | null>(null);
  if (editing) return <FilterEditor def={editing} filters={filters} onChange={onChange} onBack={() => setEditing(null)} onDone={onDone} />;

  return (
    <div className="space-y-3">
      {FILTER_GROUPS.map((group) => (
        <div key={group}>
          <h3 className="mb-1 px-1.5 text-xs font-medium text-ink-3">{group}</h3>
          <ul>
            {FILTER_DEFS.filter((def) => def.group === group).map((def) => (
              <li key={def.id}>
                <button
                  type="button"
                  onClick={() => setEditing(def)}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="flex-1">{def.label}</span>
                  {isFilterSet(def, filters) && (
                    <span className="inline-flex items-center gap-1 text-xs text-accent-ink">
                      <Check className="size-3.5" aria-hidden="true" />
                      Set
                    </span>
                  )}
                  <ChevronRight className="size-4 text-ink-3" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
