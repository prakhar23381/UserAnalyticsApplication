import Link from 'next/link';

interface Props {
  page: number;
  limit: number;
  total: number;
  hrefFor: (page: number) => string;
}

const linkClass =
  'rounded-md border border-neutral-200 bg-white px-3 py-1.5 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800';
const disabledClass =
  'rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600';

export default function Pagination({ page, limit, total, hrefFor }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const first = Math.min((page - 1) * limit + 1, total);
  const last = Math.min(page * limit, total);

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-sm">
      <p className="text-neutral-500">
        Showing <span className="tabular-nums">{first}–{last}</span> of{' '}
        <span className="tabular-nums">{total}</span>
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(Math.min(page - 1, lastPage))} className={linkClass}>
            ← Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            ← Previous
          </span>
        )}
        {page < lastPage ? (
          <Link href={hrefFor(page + 1)} className={linkClass}>
            Next →
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}
