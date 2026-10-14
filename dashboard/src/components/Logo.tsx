/** The Trailmark mark: a dotted trail ending in a ring (a visit, then a click). */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <circle cx="8" cy="24" r="2" fill="white" opacity="0.5" />
      <circle cx="12.5" cy="19" r="2" fill="white" opacity="0.7" />
      <circle cx="17" cy="14.5" r="2" fill="white" opacity="0.88" />
      <circle cx="23" cy="9.5" r="4" fill="none" stroke="white" strokeWidth="2.5" />
    </svg>
  );
}

export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">Trailmark</span>
    </span>
  );
}
