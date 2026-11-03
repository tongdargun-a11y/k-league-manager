import { X } from 'lucide-react';
import { useGame } from '../store/gameStore';

export function Toasts() {
  const toasts = useGame((s) => s.toasts);
  const dismiss = useGame((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${
            t.tone === 'success' ? 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100'
            : t.tone === 'warn' ? 'border-gold-500/50 bg-navy-800/95 text-gold-300'
            : t.tone === 'error' ? 'border-rose-400/50 bg-rose-950/90 text-rose-100'
            : 'border-navy-600 bg-navy-800/95 text-slate-100'}`}
        >
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-white" aria-label="닫기"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
