import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import Lab from '@/components/lab/Lab';

export const metadata: Metadata = { title: 'UI lab', robots: { index: false } };

// A local workbench for the UI, never part of a deployment: `next build` runs
// with NODE_ENV=production, so the built page is a 404.
export default function LabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <Suspense>
      <Lab />
    </Suspense>
  );
}
