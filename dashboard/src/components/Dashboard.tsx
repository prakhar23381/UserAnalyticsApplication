'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import HeatmapView from '@/components/HeatmapView';
import OverviewTab from '@/components/OverviewTab';
import SessionsTab from '@/components/SessionsTab';
import Tabs, { TAB_META } from '@/components/Tabs';
import { parseTab } from '@/lib/url';

/** The whole dashboard: the tabs, then the active tab's view. */
export default function Dashboard() {
  const tab = parseTab(useSearchParams().get('tab'));

  useEffect(() => {
    document.title = `${TAB_META[tab].label} · Trailmark`;
  }, [tab]);

  return (
    <>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4">
          <Tabs active={tab} />
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'heatmaps' && <HeatmapView />}
      </main>
    </>
  );
}
