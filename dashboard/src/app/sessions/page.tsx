import type { Metadata } from 'next';
import { Suspense } from 'react';
import PageHeading from '@/components/PageHeading';
import SessionsTable from '@/components/SessionsTable';
import { LoadingState } from '@/components/States';

export const metadata: Metadata = { title: 'Sessions' };

export default function SessionsPage() {
  return (
    <>
      <PageHeading title="Sessions">
        Every visit the tracker recorded, most recent activity first. Open one to see its journey.
      </PageHeading>
      {/* SessionsTable reads ?page= on the client, which needs a Suspense boundary. */}
      <Suspense fallback={<LoadingState rows={8} />}>
        <SessionsTable />
      </Suspense>
    </>
  );
}
