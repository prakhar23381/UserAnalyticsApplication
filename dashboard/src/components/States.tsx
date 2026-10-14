'use client';

import { Inbox, TriangleAlert } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { API_URL, ApiError } from '@/lib/api';

// The API's free hosting tier sleeps when idle; its first answer can take 30–50 s.
const SLOW_MS = 5000;

export function LoadingState({ rows = 6 }: { rows?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
      {slow && (
        <p className="mt-4 text-center text-sm text-ink-3">
          Waking up the API. After a quiet spell, the first request can take up to a minute.
        </p>
      )}
    </div>
  );
}

function describeError(error: Error): string {
  if (error instanceof ApiError) return error.message;
  return `Can't reach the API at ${API_URL}. Is the server running?`;
}

/**
 * A failed request. With `stale`, the view still shows the last data it got,
 * so this is a one-line notice instead of the whole message.
 */
export function ErrorState({ error, stale = false }: { error: Error; stale?: boolean }) {
  if (stale) {
    return (
      <p role="status" className="mb-3 inline-flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-400">
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        Couldn&apos;t refresh, showing the last data. {describeError(error)}
      </p>
    );
  }
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-medium">{describeError(error)}</p>
        <p className="mt-1 opacity-80">Retrying automatically.</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <Inbox className="size-6 text-ink-3" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-ink-3">{children}</div>}
    </div>
  );
}
