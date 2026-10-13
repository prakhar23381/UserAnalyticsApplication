import type { Metadata } from 'next';
import { Suspense } from 'react';
import HeatmapView from '@/components/HeatmapView';
import PageHeading from '@/components/PageHeading';
import { LoadingState } from '@/components/States';

export const metadata: Metadata = { title: 'Heatmap' };

export default function HeatmapPage() {
  return (
    <>
      <PageHeading title="Heatmap">
        Where visitors click on a page, drawn over the live page at a fixed width for each device.
      </PageHeading>
      {/* HeatmapView reads ?page=, ?device= and ?mode= on the client, which needs a Suspense boundary. */}
      <Suspense fallback={<LoadingState />}>
        <HeatmapView />
      </Suspense>
    </>
  );
}
