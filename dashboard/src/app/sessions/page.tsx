import { redirect } from 'next/navigation';
import { legacyHref } from '@/lib/url';

// The pre-v2 sessions list; links to it keep working.
export default async function LegacySessions({ searchParams }: PageProps<'/sessions'>) {
  const { page } = await searchParams;
  redirect(legacyHref('/sessions', new URLSearchParams(typeof page === 'string' ? { page } : {})));
}
