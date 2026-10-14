const ROLES = [
  ['canvas', 'Page background'],
  ['surface', 'Cards, bars'],
  ['surface-2', 'Headers, hover'],
  ['line', 'Borders'],
  ['ink', 'Text'],
  ['ink-2', 'Secondary text'],
  ['ink-3', 'Labels, hints'],
  ['accent', 'Links, active'],
  ['accent-soft', 'Active background'],
  ['accent-ink', 'Text on soft accent'],
] as const;

const BRAND = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const TYPE = [
  ['text-xl font-semibold', 'Page title · 20/600'],
  ['text-lg font-semibold', 'Section · 18/600'],
  ['text-sm font-semibold', 'Card title · 14/600'],
  ['text-sm', 'Body · 14/400'],
  ['text-xs font-medium text-ink-3', 'Label · 12/500'],
  ['font-mono text-xs', 'Code · 12 mono'],
] as const;

/** The design tokens from globals.css. Role colours change with the theme. */
export default function TokensSection() {
  return (
    <section aria-labelledby="tokens" className="space-y-4">
      <h2 id="tokens" className="text-lg font-semibold">Tokens</h2>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
        <h3 className="mb-3 text-sm font-semibold">Role colours</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {ROLES.map(([name, use]) => (
            <div key={name} className="text-xs">
              <div className="h-12 rounded-lg border border-line" style={{ background: `var(--${name})` }} />
              <p className="mt-1.5 font-mono">{name}</p>
              <p className="text-ink-3">{use}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
        <h3 className="mb-3 text-sm font-semibold">Brand scale</h3>
        <div className="flex overflow-hidden rounded-lg border border-line">
          {BRAND.map((step) => (
            <div key={step} className="flex-1 text-center text-[10px]">
              <div className="h-10" style={{ background: `var(--color-brand-${step})` }} />
              <p className="py-1 font-mono text-ink-3">{step}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface p-4 shadow-xs">
        <h3 className="mb-3 text-sm font-semibold">Type</h3>
        <div className="space-y-2">
          {TYPE.map(([className, label]) => (
            <p key={label} className={className}>
              {label}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
