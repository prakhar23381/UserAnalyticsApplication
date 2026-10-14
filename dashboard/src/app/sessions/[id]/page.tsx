import { redirect } from 'next/navigation';
import { legacyHref } from '@/lib/url';

// The pre-v2 journey page; links to it keep working.
export default async function LegacySession({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  redirect(legacyHref(`/sessions/${encodeURIComponent(id)}`, new URLSearchParams()));
}
