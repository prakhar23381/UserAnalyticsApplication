import type { ReactNode } from 'react';

export default function PageHeading({
  title,
  children,
  actions,
}: {
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {children && <p className="mt-1 text-sm text-ink-3">{children}</p>}
      </div>
      {actions}
    </div>
  );
}
