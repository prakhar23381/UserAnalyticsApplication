'use client';

import { Check, ChevronsLeft, Copy, Crosshair, Download, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BADGE_COUNT, elementLabel, elementsCsv } from '@/lib/heatmap';
import { formatRate } from '@/lib/overview';
import type { ElementsResponse, RankedElement } from '@/lib/types';

/** Saves the ranking as a CSV file, built in the browser. */
function downloadCsv(data: ElementsResponse, fileName: string) {
  const url = URL.createObjectURL(new Blob([elementsCsv(data.elements)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies the element's selector; says so for a moment. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink"
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy selector'}
      <span className="sr-only"> of {label}</span>
    </button>
  );
}

function ElementCard({
  element,
  focused,
  focusHref,
  onHover,
}: {
  element: RankedElement;
  focused: boolean;
  focusHref: string;
  onHover: (key: string | null) => void;
}) {
  const { name, detail } = elementLabel(element);
  const badged = element.rank <= BADGE_COUNT;
  return (
    <li
      onMouseEnter={() => onHover(element.key)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(element.key)}
      onBlur={() => onHover(null)}
      className={`rounded-lg border bg-surface p-3 ${focused ? 'border-blue-600 ring-1 ring-blue-600' : 'border-line'}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            badged ? 'bg-blue-700 text-white' : 'bg-surface-2 text-ink-3'
          }`}
          aria-label={`Rank ${element.rank}`}
        >
          {element.rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={name}>
            {name}
          </p>
          <p className="truncate font-mono text-[11px] text-ink-3" title={detail}>
            {detail}
          </p>
          <p className="mt-1 text-xs text-ink-2">
            <span className="font-medium tabular-nums">{element.clicks.toLocaleString('en')}</span> clicks ({formatRate(element.share)})
            <span className="text-ink-3">
              {' '}
              · {element.sessions.toLocaleString('en')} {element.sessions === 1 ? 'session' : 'sessions'}
            </span>
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <CopyButton text={detail} label={name} />
        <Link
          href={focusHref}
          scroll={false}
          aria-pressed={focused}
          title={focused ? 'Show every click on the page' : "Show only this element's clicks"}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-xs font-medium text-accent hover:bg-surface-2"
        >
          {focused ? <X className="size-3.5" aria-hidden="true" /> : <Crosshair className="size-3.5" aria-hidden="true" />}
          {focused ? 'Show all' : 'Only this'}
          <span className="sr-only">{focused ? ' clicks' : ` element: ${name}`}</span>
        </Link>
      </div>
    </li>
  );
}

/**
 * The page's elements ranked by clicks in the current segment and device
 * (GET /api/elements). The top ones carry the same numbers as the badges on
 * the page; each can be shown alone (the element heatmap).
 */
export default function ElementsSidebar({
  data,
  exportName,
  focus,
  focusHrefFor,
  onHover,
  onCollapse,
}: {
  data: ElementsResponse | undefined;
  exportName: string;
  focus: string | null;
  focusHrefFor: (key: string | null) => string;
  onHover: (key: string | null) => void;
  onCollapse: () => void;
}) {
  return (
    <aside className="order-last min-w-0 rounded-xl border border-line bg-surface-2/60 p-3 shadow-xs lg:order-none lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Ranked by most clicks</h2>
          <p className="text-xs text-ink-3">
            {data ? `${data.total_elements.toLocaleString('en')} ${data.total_elements === 1 ? 'element' : 'elements'}` : '…'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!data || data.elements.length === 0}
            onClick={() => data && downloadCsv(data, exportName)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-ink-3 hover:bg-surface hover:text-ink disabled:opacity-50"
          >
            <Download className="size-4" aria-hidden="true" />
            CSV
            <span className="sr-only"> export of the ranking</span>
          </button>
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-ink-3 hover:bg-surface hover:text-ink"
          >
            <ChevronsLeft className="size-4" aria-hidden="true" />
            Hide
            <span className="sr-only"> the ranking</span>
          </button>
        </div>
      </div>
      {data && data.elements.length === 0 && <p className="text-sm text-ink-3">No clicks to rank on this page yet.</p>}
      <ol className="space-y-2">
        {data?.elements.map((element) => (
          <ElementCard
            key={element.key}
            element={element}
            focused={element.key === focus}
            focusHref={focusHrefFor(element.key === focus ? null : element.key)}
            onHover={onHover}
          />
        ))}
      </ol>
      {data && data.total_elements > data.elements.length && (
        <p className="mt-2 text-xs text-ink-3">Showing the top {data.elements.length}.</p>
      )}
    </aside>
  );
}
