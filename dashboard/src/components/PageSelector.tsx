'use client';

import { pathOf } from '@/lib/format';
import type { PageSummary } from '@/lib/types';

interface Props {
  pages: PageSummary[];
  value: string | null;
  onChange: (pageUrl: string) => void;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
};

export default function PageSelector({ pages, value, onChange }: Props) {
  // A page from a link (e.g. a journey) may not be in the list yet.
  const options: Pick<PageSummary, 'page_url' | 'clicks'>[] =
    value && !pages.some((page) => page.page_url === value) ? [{ page_url: value, clicks: 0 }, ...pages] : pages;
  // Paths alone are ambiguous once more than one site sends events.
  const showHost = new Set(options.map((page) => hostOf(page.page_url))).size > 1;

  return (
    <label className="flex w-full min-w-0 flex-col gap-1 text-sm sm:w-auto sm:min-w-72 sm:flex-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Page</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-800 dark:bg-neutral-900"
      >
        {options.map((page) => (
          <option key={page.page_url} value={page.page_url}>
            {showHost ? `${hostOf(page.page_url)}${pathOf(page.page_url)}` : pathOf(page.page_url)} ({page.clicks}{' '}
            {page.clicks === 1 ? 'click' : 'clicks'})
          </option>
        ))}
      </select>
    </label>
  );
}
