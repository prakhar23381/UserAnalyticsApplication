import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'CausalFunnel Analytics', template: '%s · CausalFunnel' },
  description: 'Sessions, user journeys and click heatmaps recorded by the CausalFunnel tracker.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
