'use client';

import { Bookmark, ChevronDown, Eye, EyeOff, Pencil, Save, Star, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import Popover from '@/components/Popover';
import { type Filters, SEGMENT_KEYS } from '@/lib/filters';
import { useDashboardHref } from '@/lib/navigation';
import {
  addSegment,
  applySegment,
  isWatched,
  matchSegment,
  MAX_NAME,
  parseDefaultSegment,
  parseSegments,
  removeSegment,
  renameProblem,
  renameSegment,
  type SavedSegment,
  saveProblem,
  segmentQuery,
  STORAGE_KEYS,
  toggleWatch,
} from '@/lib/segments';
import { readStored, useDefaultSegment, useSavedSegments, useWatchlist } from '@/lib/storage';
import type { Changes } from '@/lib/url';

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

const action =
  'inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-ink-2 hover:bg-surface-2 hover:text-ink';

function NameForm({
  initial = '',
  submitLabel,
  problemFor,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  problemFor: (name: string) => string | null;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = problemFor(name);
    if (found) setProblem(found);
    else onSubmit(name);
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-3">Name</span>
        <input
          value={name}
          maxLength={MAX_NAME}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          placeholder="e.g. Phones from Instagram"
          aria-invalid={Boolean(problem)}
          aria-describedby={problem ? 'segment-name-problem' : undefined}
          className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5"
        />
      </label>
      {problem && (
        <p id="segment-name-problem" className="text-xs text-delta-bad">
          {problem}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
          <Save className="size-3.5" aria-hidden="true" />
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-2 text-xs font-medium text-ink-3 hover:text-ink">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        aria-current={on ? 'true' : undefined}
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-2 ${on ? 'font-medium text-accent-ink' : ''}`}
      >
        <span className={`size-1.5 shrink-0 rounded-full ${on ? 'bg-accent' : 'bg-transparent'}`} aria-hidden="true" />
        {children}
      </button>
    </li>
  );
}

/** The panel: pick a segment; save, rename, delete, star or watch the current one. */
function SegmentPanel({ filters, onChange, onDone }: { filters: Filters; onChange: (changes: Changes) => void; onDone: () => void }) {
  const [segments, setSegments] = useSavedSegments();
  const [defaultId, setDefaultId] = useDefaultSegment();
  const [watchlist, setWatchlist] = useWatchlist();
  const [mode, setMode] = useState<'idle' | 'rename' | 'delete'>('idle');
  const query = segmentQuery(filters);
  const current = matchSegment(segments, filters);

  const pick = (changes: Changes) => {
    onChange(changes);
    onDone();
  };
  const save = (name: string) => {
    setSegments(addSegment(segments, { id: newId(), name, query }));
  };
  const remove = (segment: SavedSegment) => {
    setSegments(removeSegment(segments, segment.id));
    if (defaultId === segment.id) setDefaultId(null);
    setWatchlist(watchlist.filter((item) => !(item.kind === 'segment' && item.id === segment.id)));
    setMode('idle');
  };

  const watched = current ? isWatched(watchlist, { kind: 'segment', id: current.id }) : false;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="mb-1 px-1.5 text-xs font-medium text-ink-3">Segments</h3>
        <ul>
          <Option on={!query} onClick={() => pick(applySegment(''))}>
            All visitors
          </Option>
          {segments.map((segment) => (
            <Option key={segment.id} on={segment.id === current?.id} onClick={() => pick(applySegment(segment.query))}>
              <span className="min-w-0 flex-1 truncate">{segment.name}</span>
              {segment.id === defaultId && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-3">
                  <Star className="size-3.5" aria-hidden="true" />
                  Default
                </span>
              )}
            </Option>
          ))}
        </ul>
        {segments.length === 0 && <p className="px-1.5 pt-1 text-xs text-ink-3">No saved segments yet.</p>}
      </div>

      <div className="border-t border-line pt-3">
        {current && mode === 'rename' && (
          <NameForm
            initial={current.name}
            submitLabel="Rename"
            problemFor={(name) => renameProblem(segments, current.id, name)}
            onSubmit={(name) => {
              setSegments(renameSegment(segments, current.id, name));
              setMode('idle');
            }}
            onCancel={() => setMode('idle')}
          />
        )}
        {current && mode === 'delete' && (
          <div className="space-y-2">
            <p>
              Delete <span className="font-medium">{current.name}</span>? Its filters stay applied until you change them.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => remove(current)} className={`${action} border-delta-bad text-delta-bad`}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </button>
              <button type="button" onClick={() => setMode('idle')} className="px-2 text-xs font-medium text-ink-3 hover:text-ink">
                Cancel
              </button>
            </div>
          </div>
        )}
        {current && mode === 'idle' && (
          <div className="space-y-2">
            <p className="truncate text-xs text-ink-3">
              Showing <span className="font-medium text-ink">{current.name}</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setDefaultId(defaultId === current.id ? null : current.id)} className={action} aria-pressed={defaultId === current.id}>
                <Star className={`size-3.5 ${defaultId === current.id ? 'fill-current' : ''}`} aria-hidden="true" />
                {defaultId === current.id ? 'Default' : 'Make default'}
              </button>
              <button
                type="button"
                onClick={() => setWatchlist(toggleWatch(watchlist, { kind: 'segment', id: current.id }))}
                className={action}
                aria-pressed={watched}
              >
                {watched ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
                {watched ? 'Unwatch' : 'Watch'}
              </button>
              <button type="button" onClick={() => setMode('rename')} className={action}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Rename
              </button>
              <button type="button" onClick={() => setMode('delete')} className={action}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
            {defaultId === current.id && <p className="text-xs text-ink-3">Applied when the dashboard opens without filters.</p>}
          </div>
        )}
        {!current && query && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-ink-3">Save these filters as a segment</h3>
            <NameForm submitLabel="Save segment" problemFor={(name) => saveProblem(segments, name, query)} onSubmit={save} />
          </div>
        )}
        {!current && !query && <p className="text-xs text-ink-3">Add filters, then save them here as a segment. Saved segments stay in this browser.</p>}
      </div>
    </div>
  );
}

// Once per page load, not on every visit to "/" within it: choosing "All visitors" afterwards sticks.
let defaultChecked = false;

/** Applies the default segment when the dashboard opens with no filters in its URL. */
export function useDefaultSegmentOnce() {
  const router = useRouter();
  const params = useSearchParams();
  const hrefFor = useDashboardHref();
  useEffect(() => {
    if (defaultChecked) return;
    defaultChecked = true;
    if (SEGMENT_KEYS.some((key) => params.has(key))) return; // a shared link's filters win
    const id = parseDefaultSegment(readStored(STORAGE_KEYS.defaultSegment));
    const segment = parseSegments(readStored(STORAGE_KEYS.segments)).find((s) => s.id === id);
    if (segment) router.replace(hrefFor(applySegment(segment.query)), { scroll: false });
  }, [params, router, hrefFor]);
}

/** The segment picker at the start of the filter bar. Saved segments live in this browser (D3). */
export default function SegmentMenu({ filters, onChange }: { filters: Filters; onChange: (changes: Changes) => void }) {
  const [segments] = useSavedSegments();
  const query = segmentQuery(filters);
  const name = query ? (matchSegment(segments, filters)?.name ?? 'Unsaved filters') : 'All visitors';
  return (
    <Popover
      label="Segments"
      buttonClassName="inline-flex max-w-64 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-medium shadow-xs hover:bg-surface-2"
      button={
        <>
          <Bookmark className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <span className="sr-only">Segment: </span>
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
        </>
      }
    >
      {(close) => <SegmentPanel filters={filters} onChange={onChange} onDone={close} />}
    </Popover>
  );
}
