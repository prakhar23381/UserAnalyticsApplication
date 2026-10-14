'use client';

import { useSearchParams } from 'next/navigation';
import PageHeading from '@/components/PageHeading';
import SessionJourney from '@/components/SessionJourney';
import SessionsTable from '@/components/SessionsTable';

/** The sessions list, or one session's journey when ?session= is set. */
export default function SessionsTab() {
  const session = useSearchParams().get('session');
  if (session) return <SessionJourney id={session} />;
  return (
    <>
      <PageHeading title="Sessions">
        Every visit the tracker recorded, most recent activity first. Open one to see its journey.
      </PageHeading>
      <SessionsTable />
    </>
  );
}
