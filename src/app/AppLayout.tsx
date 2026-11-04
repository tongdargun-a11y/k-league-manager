import { useState } from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { CalendarDays, Dumbbell, LayoutDashboard, ListOrdered, Menu, Save, Shirt, Swords, Users, X, LogOut, Loader2, ArrowLeftRight, Wallet } from 'lucide-react';
import { useGame } from '../store/gameStore';
import { ClockControls } from '../components/ClockControls';
import { ClubBadge } from '../components/ClubBadge';
import { useGameClock } from './useGameClock';
import { formatShort } from '../utils/date';
import { TestDataBadge } from '../components/TestDataBadge';

const NAV = [
  { to: '/game', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/game/squad', label: '선수단', icon: Users },
  { to: '/game/tactics', label: '전술·라인업', icon: Shirt },
  { to: '/game/fixtures', label: '일정', icon: CalendarDays },
  { to: '/game/standings', label: '순위', icon: ListOrdered },
  { to: '/game/match', label: '경기', icon: Swords },
  { to: '/game/training', label: '훈련', icon: Dumbbell },
  { to: '/game/transfers', label: '이적시장', icon: ArrowLeftRight },
  { to: '/game/finance', label: '재정', icon: Wallet },
  { to: '/game/saves', label: '저장·설정', icon: Save },
];

export function AppLayout() {
  const world = useGame((s) => s.world);
  const saving = useGame((s) => s.saving);
  const saveGame = useGame((s) => s.saveGame);
  const exit = useGame((s) => s.exitToTitle);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useGameClock();

  if (!world) return <Navigate to="/" replace />;
  const club = world.clubs[world.userClubId];

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="주 메뉴">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${
              isActive ? 'bg-navy-700 text-gold-400' : 'text-slate-300 hover:bg-navy-800 hover:text-white'}`
          }
        >
          <Icon size={18} /> {label}
        </NavLink>
      ))}
    </nav>
  );

  const clubHeader = (
    <div className="mb-6 flex items-center gap-3 px-1">
      <ClubBadge club={club} size={40} />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-white">{club.name}</div>
        <div className="truncate text-xs text-slate-400">{world.manager.name} 감독</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden border-r border-navy-700 bg-navy-900 p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
        <div className="mb-6 px-1 text-xs font-black tracking-[0.25em] text-gold-400">VIRTUAL FM</div>
        {clubHeader}
        {nav}
        <div className="mt-auto space-y-2 pt-6">
          <TestDataBadge />
          <button className="btn-ghost w-full" onClick={() => { exit(); navigate('/'); }}><LogOut size={16} /> 타이틀로</button>
        </div>
      </aside>

      {/* 모바일 메뉴 */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64 border-r border-navy-700 bg-navy-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-black tracking-[0.25em] text-gold-400">VIRTUAL FM</span>
              <button onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="text-slate-400"><X size={20} /></button>
            </div>
            {clubHeader}
            {nav}
            <button className="btn-ghost mt-6 w-full" onClick={() => { exit(); navigate('/'); }}><LogOut size={16} /> 타이틀로</button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-navy-700 bg-navy-950/95 px-4 py-2.5 backdrop-blur">
          <button className="text-slate-300 lg:hidden" onClick={() => setOpen(true)} aria-label="메뉴 열기"><Menu size={22} /></button>
          <div className="min-w-0 flex-1">
            <div className="hidden truncate text-xs text-slate-400 sm:block">{world.competition.shortName} · {world.season.label}</div>
            <div className="truncate text-sm font-semibold text-white md:hidden">{formatShort(world.clock.gameDate)}</div>
          </div>
          <ClockControls />
          <button className="btn-ghost px-2.5" onClick={() => saveGame()} disabled={saving} title="저장" aria-label="저장">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          </button>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
