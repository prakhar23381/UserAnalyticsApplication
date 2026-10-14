import { redirect } from 'next/navigation';
import { legacyHref } from '@/lib/url';

// The pre-v2 heatmap page; links to it (and their page/device/mode) keep working.
export default async function LegacyHeatmap({ searchParams }: PageProps<'/heatmap'>) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const key of ['page', 'device', 'mode']) {
    const value = query[key];
    if (typeof value === 'string') params.set(key, value);
  }
  redirect(legacyHref('/heatmap', params));
}
