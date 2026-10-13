'use client';

import { useEffect, useState } from 'react';
import { formatDateTime, timeAgo } from '@/lib/format';

/** "5 minutes ago", kept current; the exact time is in the tooltip. */
export default function RelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {timeAgo(iso, now)}
    </time>
  );
}
