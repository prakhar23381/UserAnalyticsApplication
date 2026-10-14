import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface Props<T extends string> {
  label: string;
  options: ToggleOption<T>[];
  value: T;
  hrefFor: (value: T) => string;
}

/**
 * Mutually exclusive choices, each a link, so the choice lives in the URL.
 * Every option shows its icon with its label.
 */
export default function ToggleGroup<T extends string>({ label, options, value, hrefFor }: Props<T>) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium text-ink-3">{label}</span>
      <div role="group" aria-label={label} className="inline-flex w-fit rounded-lg border border-line bg-surface p-0.5 shadow-xs">
        {options.map(({ value: optionValue, label: optionLabel, icon: Icon, disabled }) => {
          const active = optionValue === value;
          const content = (
            <>
              {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
              {optionLabel}
            </>
          );
          const base = 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium whitespace-nowrap';
          if (disabled) {
            return (
              <span key={optionValue} aria-disabled="true" className={`${base} cursor-not-allowed text-ink-3 opacity-50`}>
                {content}
              </span>
            );
          }
          return (
            <Link
              key={optionValue}
              href={hrefFor(optionValue)}
              scroll={false}
              aria-current={active ? 'true' : undefined}
              className={`${base} ${active ? 'bg-accent text-white shadow-xs' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
