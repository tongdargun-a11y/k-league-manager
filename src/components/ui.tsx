import type { ReactNode } from 'react';

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel p-4 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="panel-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="stat-num text-2xl leading-tight">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-navy-600 p-6 text-center text-sm text-slate-400">
      <div className="font-semibold text-slate-200">{title}</div>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function OvrBadge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const tone = value >= 75 ? 'text-gold-400 border-gold-500/60' : value >= 65 ? 'text-emerald-300 border-emerald-400/40' : 'text-slate-300 border-navy-600';
  const s = size === 'lg' ? 'h-14 w-14 text-2xl' : size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  return <span className={`inline-flex items-center justify-center rounded-md border bg-navy-900 font-bold tabular-nums ${tone} ${s}`}>{value}</span>;
}

export function Bar({ value, max = 100, tone }: { value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone ?? (pct >= 75 ? 'bg-emerald-400' : pct >= 50 ? 'bg-gold-400' : 'bg-rose-400');
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-700" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function FormDots({ form }: { form: ('W' | 'D' | 'L')[] }) {
  if (!form.length) return <span className="text-xs text-slate-500">-</span>;
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <span key={i} className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${r === 'W' ? 'bg-emerald-500/80 text-white' : r === 'D' ? 'bg-slate-500/70 text-white' : 'bg-rose-500/80 text-white'}`}>
          {r === 'W' ? '승' : r === 'D' ? '무' : '패'}
        </span>
      ))}
    </span>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-navy-600 bg-navy-900 p-0.5" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${value === o.value ? 'bg-gold-500 text-navy-950' : 'text-slate-300 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
