'use client';

import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';

/**
 * A button that opens a small panel under it: the filter menus. Clicking
 * outside or pressing Esc closes it, and focus goes back to the button. On
 * phones the panel sits at the bottom of the screen instead, so it never runs
 * off the side.
 */
export default function Popover({
  label,
  button,
  buttonClassName,
  panelClassName = 'sm:w-80',
  align = 'left',
  children,
}: {
  /** The panel's accessible name. */
  label: string;
  button: ReactNode;
  buttonClassName: string;
  panelClassName?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}) {
  // 'returning': closed from inside or with Esc, so focus goes back to the button.
  const [status, setStatus] = useState<'open' | 'closed' | 'returning'>('closed');
  const open = status === 'open';
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback(() => setStatus('returning'), []);

  useEffect(() => {
    if (status === 'returning') trigger.current?.focus();
    if (!open) return;
    // Focus the first control inside, so the keyboard can carry on from the button.
    panel.current?.querySelector<HTMLElement>('input, button, select, a[href]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setStatus('closed');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setStatus('returning');
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, status]);

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        onClick={() => setStatus(open ? 'closed' : 'open')}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label={label}
          className={`z-40 rounded-xl border border-line bg-surface p-3 text-sm shadow-lg max-sm:fixed max-sm:inset-x-4 max-sm:bottom-4 max-sm:max-h-[70vh] max-sm:overflow-y-auto sm:absolute sm:top-full sm:mt-2 ${
            align === 'right' ? 'sm:right-0' : 'sm:left-0'
          } ${panelClassName}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
