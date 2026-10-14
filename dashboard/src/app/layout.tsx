import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import TopBar from '@/components/TopBar';
import './globals.css';

// Self-hosted by next/font at build time: visitors make no request to Google.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Trailmark', template: '%s · Trailmark' },
  description: 'Sessions, user journeys and click heatmaps recorded by the Trailmark tracker.',
};

// Runs before the first paint, so the page never flashes the wrong theme: the
// OS preference (followed live), unless the URL says ?theme=light|dark.
const themeScript = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var m=matchMedia('(prefers-color-scheme: dark)');var set=function(){document.documentElement.dataset.theme=p==='light'||p==='dark'?p:m.matches?'dark':'light'};set();if(p!=='light'&&p!=='dark')m.addEventListener('change',set)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // data-theme is set by the script before React hydrates.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-ink antialiased">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
