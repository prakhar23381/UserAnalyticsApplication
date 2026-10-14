import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { DEMO_URL } from '@/lib/config';

export default function TopBar() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="Trailmark: overview" className="rounded-md">
          <Logo />
        </Link>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Demo site
        </a>
      </div>
    </header>
  );
}
