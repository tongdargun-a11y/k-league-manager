import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWorld } from '../../store/gameStore';
import { ClubBadge } from '../../components/ClubBadge';
import { Panel, Segmented } from '../../components/ui';
import { TestDataBadge } from '../../components/TestDataBadge';
import { formatShort, parseDate, WEEKDAY_LABELS } from '../../utils/date';
import type { Fixture } from '../../types';

export function FixturesPage() {
  const world = useWorld();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [month, setMonth] = useState(world.clock.gameDate.slice(0, 7));
  const [round, setRound] = useState<number | 'all'>('all');
  const uid = world.userClubId;
  const mine = (f: Fixture) => f.homeClubId === uid || f.awayClubId === uid;
  const fixtures = useMemo(
    () => world.fixtures.filter((f) => (scope === 'mine' ? mine(f) : true)).filter((f) => round === 'all' || f.round === round).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world.fixtures, scope, round, uid],
  );
  const rounds = Math.max(...world.fixtures.map((f) => f.round));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black text-white">경기 일정</h1>
        {world.season.scheduleSource === 'test' && <TestDataBadge text="테스트용 일정" />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={view} onChange={setView} options={[{ value: 'list', label: '목록' }, { value: 'calendar', label: '월간 달력' }]} />
        <Segmented value={scope} onChange={setScope} options={[{ value: 'mine', label: '내 팀' }, { value: 'all', label: '전체' }]} />
        {view === 'list' && (
          <select className="input w-auto" value={round} onChange={(e) => setRound(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="라운드">
            <option value="all">전체 라운드</option>
            {Array.from({ length: rounds }, (_, i) => <option key={i} value={i + 1}>{i + 1}라운드</option>)}
          </select>
        )}
      </div>
      {view === 'list' ? <FixtureList fixtures={fixtures} /> : <MonthCalendar fixtures={fixtures} month={month} setMonth={setMonth} />}
    </div>
  );
}

function FixtureRow({ f }: { f: Fixture }) {
  const world = useWorld();
  const uid = world.userClubId;
  const home = world.clubs[f.homeClubId];
  const away = world.clubs[f.awayClubId];
  const involved = f.homeClubId === uid || f.awayClubId === uid;
  const isToday = f.date === world.clock.gameDate;
  const status = f.status === 'played' ? '종료' : isToday ? '오늘' : f.date < world.clock.gameDate ? '대기' : '예정';
  return (
    <li className={`flex items-center gap-2 px-3 py-2.5 text-sm ${involved && f.status !== 'played' && isToday ? 'bg-gold-500/10' : ''}`}>
      <span className="w-20 shrink-0 text-xs text-slate-400">{formatShort(f.date)}<div className="text-[10px] text-slate-500">{f.round}R</div></span>
      <span className={`flex flex-1 items-center justify-end gap-2 truncate text-right ${f.homeClubId === uid ? 'font-bold text-gold-300' : ''}`}>{home.shortName}<ClubBadge club={home} size={22} /></span>
      <span className="w-14 text-center font-bold tabular-nums">{f.result ? `${f.result.homeGoals} : ${f.result.awayGoals}` : 'vs'}</span>
      <span className={`flex flex-1 items-center gap-2 truncate ${f.awayClubId === uid ? 'font-bold text-gold-300' : ''}`}><ClubBadge club={away} size={22} />{away.shortName}</span>
      <span className={`hidden w-12 text-right text-xs sm:block ${status === '오늘' ? 'text-gold-400' : 'text-slate-500'}`}>{status}</span>
      {involved && <span className="hidden w-8 text-right text-[11px] text-slate-400 sm:block">{f.homeClubId === uid ? '홈' : '원정'}</span>}
    </li>
  );
}

function FixtureList({ fixtures }: { fixtures: Fixture[] }) {
  if (!fixtures.length) return <Panel><p className="text-sm text-slate-400">표시할 경기가 없습니다.</p></Panel>;
  return (
    <Panel className="p-0">
      <ul className="divide-y divide-navy-700">{fixtures.map((f) => <FixtureRow key={f.id} f={f} />)}</ul>
    </Panel>
  );
}

function MonthCalendar({ fixtures, month, setMonth }: { fixtures: Fixture[]; month: string; setMonth: (m: string) => void }) {
  const world = useWorld();
  const [y, m] = month.split('-').map(Number);
  const first = parseDate(`${month}-01`);
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const shift = (d: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + d, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };
  const byDate = new Map<string, Fixture[]>();
  for (const f of fixtures) byDate.set(f.date, [...(byDate.get(f.date) ?? []), f]);
  const cells: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const uid = world.userClubId;

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <button className="btn-ghost px-2" onClick={() => shift(-1)} aria-label="이전 달"><ChevronLeft size={16} /></button>
        <div className="font-bold text-white">{y}년 {m}월</div>
        <button className="btn-ghost px-2" onClick={() => shift(1)} aria-label="다음 달"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-400">
        {WEEKDAY_LABELS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="min-h-[64px] rounded bg-navy-900/40" />;
          const date = `${month}-${String(d).padStart(2, '0')}`;
          const list = byDate.get(date) ?? [];
          const isToday = date === world.clock.gameDate;
          return (
            <div key={i} className={`min-h-[64px] rounded border p-1 text-left ${isToday ? 'border-gold-500' : 'border-navy-700'} bg-navy-900`}>
              <div className={`text-[11px] ${isToday ? 'font-bold text-gold-400' : 'text-slate-400'}`}>{d}</div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((f) => {
                  const mine = f.homeClubId === uid || f.awayClubId === uid;
                  const opp = world.clubs[f.homeClubId === uid ? f.awayClubId : f.homeClubId];
                  return (
                    <div key={f.id} className={`truncate rounded px-1 text-[10px] ${mine ? 'bg-gold-500/20 text-gold-200' : 'bg-navy-700 text-slate-300'}`}>
                      {mine ? `${f.homeClubId === uid ? 'H' : 'A'} ${opp.shortName}` : `${world.clubs[f.homeClubId].shortName}-${world.clubs[f.awayClubId].shortName}`}
                      {f.result && ` ${f.result.homeGoals}:${f.result.awayGoals}`}
                    </div>
                  );
                })}
                {list.length > 3 && <div className="text-[10px] text-slate-500">+{list.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
