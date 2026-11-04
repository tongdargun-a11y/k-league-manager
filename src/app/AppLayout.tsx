import { NavLink, Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { canOpen, modeOf, MODE_INFO } from '../engine/modes';
import { LayoutDashboard, Save, Swords, Users, LogOut, Loader2, ArrowLeftRight, Building2 } from 'lucide-react';
import { useGame } from '../store/gameStore';
import { ClockControls } from '../components/ClockControls';
import { ClubBadge } from '../components/ClubBadge';
import { useGameClock } from './useGameClock';
import { formatShort } from '../utils/date';
import { TestDataBadge } from '../components/TestDataBadge';

type NavItem = { to: string; label: string; end?: boolean };
/** 상단 2단 메뉴: 섹션 → 하위 탭. 모드 권한(canOpen)으로 보이는 탭만 남기고, 탭이 없는 섹션은 숨긴다. */
const SECTIONS: { key: string; label: string; icon: typeof LayoutDashboard; items: NavItem[]; match?: string[] }[] = [
  { key: 'home', label: '홈', icon: LayoutDashboard, items: [{ to: '/game', label: '대시보드', end: true }, { to: '/game/me', label: '내 선수' }] },
  { key: 'squad', label: '선수단', icon: Users, items: [{ to: '/game/squad', label: '선수 명단' }, { to: '/game/tactics', label: '전술·라인업' }, { to: '/game/training', label: '훈련' }], match: ['/game/player/'] },
  { key: 'matchday', label: '경기일', icon: Swords, items: [{ to: '/game/fixtures', label: '일정' }, { to: '/game/standings', label: '순위' }, { to: '/game/match', label: '경기' }] },
  { key: 'transfer', label: '영입', icon: ArrowLeftRight, items: [{ to: '/game/transfers', label: '이적시장' }] },
  { key: 'club', label: '구단', icon: Building2, items: [{ to: '/game/finance', label: '재정' }, { to: '/game/club', label: '구단 시설' }] },
  { key: 'settings', label: '저장', icon: Save, items: [{ to: '/game/saves', label: '저장·설정' }] },
];

function activeSection(path: string) {
  return SECTIONS.find((s) => s.items.some((i) => (i.end ? path === i.to : path.startsWith(i.to))) || s.match?.some((m) => path.startsWith(m)))?.key ?? 'home';
}

export function AppLayout() {
  const world = useGame((s) => s.world);
  const saving = useGame((s) => s.saving);
  const saveGame = useGame((s) => s.saveGame);
  const exit = useGame((s) => s.exitToTitle);
  const navigate = useNavigate();
  const location = useLocation();
  useGameClock();

  if (!world) return <Navigate to="/" replace />;
  if (!canOpen(world, location.pathname)) return <Navigate to="/game" replace />;
  const mode = modeOf(world);
  const roleLabel = mode === 'classic' ? '감독' : MODE_INFO[mode].role;
  const club = world.clubs[world.userClubId];
  const sections = SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => canOpen(world, i.to)) })).filter((s) => s.items.length);
  const current = activeSection(location.pathname);
  const sub = sections.find((s) => s.key === current) ?? sections[0];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-navy-700 bg-navy-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <ClubBadge club={club} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-white">{club.name}</div>
              <div className="truncate text-xs text-slate-400">{world.manager.name} {roleLabel}{mode !== 'classic' ? ` · ${MODE_INFO[mode].label} 모드` : ''}</div>
            </div>
          </div>
          <nav className="order-3 w-full min-w-0 lg:order-none lg:w-auto lg:flex-1" aria-label="주 메뉴">
            <div className="flex gap-1 overflow-x-auto" role="tablist">
              {sections.map((s) => {
                const Icon = s.icon;
                const on = s.key === sub.key;
                return (
                  <button key={s.key} role="tab" aria-selected={on} data-testid={`section-${s.key}`} onClick={() => navigate(s.items[0].to)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[15px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 ${on ? 'text-gold-400' : 'text-slate-200 hover:bg-navy-800'}`}>
                    <Icon size={16} /> {s.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-0.5 flex gap-4 overflow-x-auto px-3 text-xs">
              {sub.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end}
                  className={({ isActive }) => `shrink-0 border-b-2 py-1 transition focus:outline-none focus-visible:text-white ${isActive ? 'border-gold-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                  {i.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[11px] text-slate-400">{world.competition.shortName} · {world.season.label}</div>
              <div className="text-sm font-semibold tabular-nums text-white md:hidden">{formatShort(world.clock.gameDate)}</div>
            </div>
            <ClockControls />
            <button className="btn-ghost px-2.5" onClick={() => saveGame()} disabled={saving} title="저장" aria-label="저장">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            </button>
            <button className="btn-ghost px-2.5" onClick={() => { exit(); navigate('/'); }} title="타이틀로" aria-label="타이틀로"><LogOut size={16} /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] p-4 md:p-5">
        <Outlet />
        <div className="mt-6"><TestDataBadge /></div>
      </main>
    </div>
  );
}
