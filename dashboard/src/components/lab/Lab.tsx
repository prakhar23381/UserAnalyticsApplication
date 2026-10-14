'use client';

import { FlaskConical, Moon, Sun } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import ComponentsSection from './ComponentsSection';
import ScreensSection from './ScreensSection';
import TokensSection from './TokensSection';

// False while rendering on the server, true in the browser. The sample
// components format dates in the viewer's locale, which the server can't know.
const noSubscribe = () => () => {};
const useInBrowser = () => useSyncExternalStore(noSubscribe, () => true, () => false);

/** Development-only workbench for the dashboard UI (app/lab/page.tsx 404s in production). */
export default function Lab() {
  const theme = useSearchParams().get('theme');
  const inBrowser = useInBrowser();
  const link = (value: 'light' | 'dark', label: string, Icon: typeof Sun) => (
    // A full load, so the theme script in layout.tsx applies the new theme before paint.
    <a
      href={`/lab?theme=${value}`}
      aria-current={theme === value ? 'true' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium ${
        theme === value ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </a>
  );

  return (
    <main className="mx-auto max-w-[1600px] space-y-10 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FlaskConical className="size-5 text-accent" aria-hidden="true" />
            UI lab
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-3">
            Iterate on the dashboard before it ships: the real screens at every width and theme (with your local data),
            each component in its states, and the design tokens. Local only: production builds return 404 here.
          </p>
        </div>
        <div className="flex gap-1">
          {link('light', 'Light', Sun)}
          {link('dark', 'Dark', Moon)}
        </div>
      </header>
      <ScreensSection />
      {inBrowser && <ComponentsSection />}
      <TokensSection />
    </main>
  );
}
