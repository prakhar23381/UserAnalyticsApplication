import { LayoutDashboard } from 'lucide-react';
import PageHeading from '@/components/PageHeading';

// Placeholder until M1b brings the totals and charts (docs/v2-plan.md).
export default function OverviewTab() {
  return (
    <>
      <PageHeading title="Overview">Totals, trends and insights for the visitors in the current segment.</PageHeading>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
        <LayoutDashboard className="size-6 text-ink-3" aria-hidden="true" />
        <p className="font-medium">Overview arrives in the next step</p>
        <p className="text-sm text-ink-3">Sessions and Heatmaps are ready in the tabs above.</p>
      </div>
    </>
  );
}
