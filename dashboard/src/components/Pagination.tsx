import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Props {
  page: number;
  limit: number;
  total: number;
  hrefFor: (page: number) => string;
}

const base = 'inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 font-medium';
const linkClass = `${base} bg-surface text-ink-2 shadow-xs hover:bg-surface-2 hover:text-ink`;
const disabledClass = `${base} cursor-not-allowed text-ink-3 opacity-50`;

export default function Pagination({ page, limit, total, hrefFor }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const first = Math.min((page - 1) * limit + 1, total);
  const last = Math.min(page * limit, total);
  const previous = (
    <>
      <ChevronLeft className="size-4" aria-hidden="true" /> Previous
    </>
  );
  const next = (
    <>
      Next <ChevronRight className="size-4" aria-hidden="true" />
    </>
  );

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-sm">
      <p className="text-ink-3">
        Showing <span className="tabular-nums">{first}–{last}</span> of <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(Math.min(page - 1, lastPage))} scroll={false} className={linkClass}>
            {previous}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {previous}
          </span>
        )}
        {page < lastPage ? (
          <Link href={hrefFor(page + 1)} scroll={false} className={linkClass}>
            {next}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {next}
          </span>
        )}
      </div>
    </nav>
  );
}
