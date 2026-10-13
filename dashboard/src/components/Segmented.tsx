import Link from 'next/link';

interface Props<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  hrefFor: (value: T) => string;
}

/** A row of mutually exclusive choices, each a link, so the choice lives in the URL. */
export default function Segmented<T extends string>({ label, options, value, hrefFor }: Props<T>) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex w-fit rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Link
              key={option.value}
              href={hrefFor(option.value)}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              className={`rounded px-3 py-1.5 font-medium ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
