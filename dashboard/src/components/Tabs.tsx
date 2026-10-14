'use client';

import { Flame, LayoutDashboard, type LucideIcon, Users } from 'lucide-react';
import Link from 'next/link';
import { useDashboardHref } from '@/lib/navigation';
import type { Tab } from '@/lib/url';

export const TAB_META: Record<Tab, { label: string; icon: LucideIcon }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  sessions: { label: 'Sessions', icon: Users },
  heatmaps: { label: 'Heatmaps', icon: Flame },
};

/** The three views of the one dashboard page. Links, so each tab has its own URL. */
export default function Tabs({ active }: { active: Tab }) {
  const hrefFor = useDashboardHref();
  return (
    <nav aria-label="Views" className="-mb-px flex gap-1 overflow-x-auto">
      {(Object.keys(TAB_META) as Tab[]).map((tab) => {
        const { label, icon: Icon } = TAB_META[tab];
        const current = tab === active;
        return (
          <Link
            key={tab}
            href={hrefFor({ tab })}
            scroll={false}
            aria-current={current ? 'page' : undefined}
            className={`inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap ${
              current ? 'border-accent text-accent-ink' : 'border-transparent text-ink-3 hover:border-line hover:text-ink'
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
