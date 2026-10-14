import { Suspense } from 'react';
import Dashboard from '@/components/Dashboard';
import { LoadingState } from '@/components/States';

export default function Home() {
  return (
    // The dashboard reads its state from the query string on the client, which needs a Suspense boundary.
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8">
          <LoadingState />
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
