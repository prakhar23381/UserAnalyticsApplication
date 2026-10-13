'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEMO_URL } from '@/lib/api';

const LINKS = [
  { href: '/sessions', label: 'Sessions' },
  { href: '/heatmap', label: 'Heatmap' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-3 text-sm sm:gap-2">
        <Link href="/sessions" className="mr-2 font-semibold tracking-tight sm:mr-6">
          CausalFunnel
        </Link>
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-md px-2 py-1.5 font-medium sm:px-3 ${
                active
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              }`}
            >
              {label}
            </Link>
          );
        })}
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto whitespace-nowrap rounded-md px-2 py-1.5 text-neutral-600 sm:px-3 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <span className="hidden sm:inline">Open demo site</span>
          <span className="sm:hidden">Demo</span> ↗
        </a>
      </nav>
    </header>
  );
}
