import type { ReactNode } from 'react';

export default function PageHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="mt-1 text-sm text-neutral-500">{children}</p>}
    </div>
  );
}
