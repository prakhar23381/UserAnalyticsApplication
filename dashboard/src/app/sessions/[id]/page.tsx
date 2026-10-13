import type { Metadata } from 'next';
import SessionJourney from '@/components/SessionJourney';
import { shortId } from '@/lib/format';

export async function generateMetadata({ params }: PageProps<'/sessions/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: `Session ${shortId(id)}` };
}

export default async function SessionPage({ params }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  return <SessionJourney id={id} />;
}
