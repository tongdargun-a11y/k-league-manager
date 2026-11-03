import { FastForward, Pause, Play, SkipForward, ChevronsRight } from 'lucide-react';
import { useGame } from '../store/gameStore';
import type { ClockSpeed } from '../types';
import { formatKorean } from '../utils/date';
import { fixtureFor } from '../engine/world';

export function ClockControls({ compact = false }: { compact?: boolean }) {
  const world = useGame((s) => s.world)!;
  const speed = useGame((s) => s.clockSpeed);
  const setSpeed = useGame((s) => s.setClockSpeed);
  const advance = useGame((s) => s.advanceOneDay);
  const live = useGame((s) => s.live);
  const todayMatch = fixtureFor(world, world.clock.gameDate, world.userClubId);
  const blocked = !!live || (todayMatch && todayMatch.status !== 'played') || world.season.status === 'finished';

  const btn = (s: ClockSpeed, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setSpeed(s)}
      disabled={s !== 'paused' && !!blocked}
      aria-pressed={speed === s}
      title={label}
      aria-label={label}
      className={`btn px-2 py-1.5 ${speed === s ? 'bg-gold-500 text-navy-950' : 'bg-navy-800 text-slate-300 hover:text-white'}`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      {!compact && (
        <div className="hidden text-right md:block">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">게임 날짜</div>
          <div className="text-sm font-semibold tabular-nums text-white">{formatKorean(world.clock.gameDate)}</div>
        </div>
      )}
      <div className="flex items-center gap-1 rounded-lg border border-navy-600 bg-navy-900 p-0.5">
        {btn('paused', <Pause size={16} />, '일시정지')}
        <button type="button" onClick={advance} disabled={!!blocked} className="btn bg-navy-800 px-2 py-1.5 text-slate-300 hover:text-white" title="하루 진행" aria-label="하루 진행">
          <SkipForward size={16} />
        </button>
        {btn('normal', <Play size={16} />, '보통 속도로 진행')}
        {btn('fast', <FastForward size={16} />, '빠르게 진행')}
        {btn('veryFast', <ChevronsRight size={16} />, '매우 빠르게 진행')}
      </div>
      {speed !== 'paused' && <span className="hidden h-2 w-2 animate-pulse rounded-full bg-emerald-400 sm:inline-block" title="날짜 진행 중" />}
    </div>
  );
}
