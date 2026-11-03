import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownUp } from 'lucide-react';
import { useWorld } from '../../store/gameStore';
import { playerOvr, positionGroup } from '../../engine/ratings/ovr';
import { seasonStatsKey } from '../../engine/world';
import { ageOn } from '../../utils/date';
import { Bar, OvrBadge, Panel, Segmented } from '../../components/ui';
import { PlayerPhoto } from '../../components/PlayerPhoto';
import { TestDataBadge } from '../../components/TestDataBadge';
import type { Player, PositionGroup } from '../../types';

type SortKey = 'ovr' | 'pot' | 'age' | 'name' | 'number' | 'fitness' | 'apps' | 'goals' | 'assists' | 'contract';

export function SquadPage() {
  const world = useWorld();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'ALL' | PositionGroup>('ALL');
  const [sort, setSort] = useState<SortKey>('ovr');
  const [desc, setDesc] = useState(true);
  const [clubId, setClubId] = useState(world.userClubId);

  const rows = useMemo(() => {
    const list = Object.values(world.players)
      .filter((p) => p.clubId === clubId)
      .filter((p) => filter === 'ALL' || positionGroup(p.positions[0]) === filter)
      .map((p) => {
        const s = world.seasonStats[seasonStatsKey(world.season.id, p.id)];
        return { p, ovr: playerOvr(p), age: ageOn(p.birthDate, world.clock.gameDate), apps: s?.appearances ?? 0, goals: s?.goals ?? 0, assists: s?.assists ?? 0, rating: s && s.ratingCount ? s.ratingSum / s.ratingCount : null };
      });
    const val = (r: (typeof list)[0]): number | string => {
      switch (sort) {
        case 'ovr': return r.ovr;
        case 'pot': return r.p.potential;
        case 'age': return r.age;
        case 'name': return r.p.name;
        case 'number': return r.p.shirtNumber;
        case 'fitness': return r.p.status.fitness;
        case 'apps': return r.apps;
        case 'goals': return r.goals;
        case 'assists': return r.assists;
        case 'contract': return r.p.contract.endDate;
      }
    };
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string, 'ko') : (x as number) - (y as number);
      return desc ? -c : c;
    });
  }, [world, filter, sort, desc, clubId]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th className={cls}>
      <button className={`inline-flex items-center gap-1 ${sort === key ? 'text-gold-400' : ''}`} onClick={() => { if (sort === key) setDesc(!desc); else { setSort(key); setDesc(key !== 'name' && key !== 'number' && key !== 'age' && key !== 'contract'); } }}>
        {label}{sort === key && <ArrowDownUp size={11} />}
      </button>
    </th>
  );

  const status = (p: Player) => p.status.injuryId ? <span className="rounded bg-rose-500/20 px-1.5 text-[11px] text-rose-300">부상</span>
    : p.status.suspendedMatches > 0 ? <span className="rounded bg-gold-500/20 px-1.5 text-[11px] text-gold-300">징계</span>
    : world.userLineup.starters.includes(p.id) ? <span className="rounded bg-emerald-500/20 px-1.5 text-[11px] text-emerald-300">선발</span>
    : world.userLineup.bench.includes(p.id) ? <span className="rounded bg-sky-500/20 px-1.5 text-[11px] text-sky-300">벤치</span> : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black text-white">선수단</h1>
        <TestDataBadge text="가상 선수 · 능력치는 게임용 추정치" />
        <select className="input ml-auto w-auto" value={clubId} onChange={(e) => setClubId(e.target.value)} aria-label="구단 선택">
          {Object.values(world.clubs).map((c) => <option key={c.id} value={c.id}>{c.name}{c.id === world.userClubId ? ' (내 팀)' : ''}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'ALL', label: '전체' }, { value: 'GK', label: 'GK' }, { value: 'DF', label: 'DF' }, { value: 'MF', label: 'MF' }, { value: 'FW', label: 'FW' }]} />
        <span className="text-sm text-slate-400">{rows.length}명</span>
        <select className="input ml-auto w-auto md:hidden" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬">
          <option value="ovr">OVR순</option><option value="pot">POT순</option><option value="age">나이순</option><option value="goals">득점순</option><option value="fitness">체력순</option>
        </select>
      </div>

      {/* 데스크톱 표 */}
      <Panel className="hidden overflow-x-auto p-0 md:block">
        <table className="table-base">
          <thead>
            <tr>
              {th('number', '#', 'w-10')}
              {th('name', '이름')}
              <th>포지션</th>
              {th('age', '나이')}
              {th('ovr', 'OVR')}
              {th('pot', 'POT')}
              {th('fitness', '체력')}
              {th('apps', '출전')}
              {th('goals', '득점')}
              {th('assists', '도움')}
              <th>평점</th>
              {th('contract', '계약')}
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, ovr, age, apps, goals, assists, rating }) => (
              <tr key={p.id} className="cursor-pointer hover:bg-navy-800" onClick={() => navigate(`/game/player/${p.id}`)}>
                <td className="tabular-nums text-slate-400">{p.shirtNumber}</td>
                <td><Link to={`/game/player/${p.id}`} className="font-semibold text-white hover:text-gold-400" onClick={(e) => e.stopPropagation()}>{p.name}</Link><div className="text-[11px] text-slate-500">{p.nationality}</div></td>
                <td className="text-xs">{p.positions.join(' · ')}</td>
                <td className="tabular-nums">{age}</td>
                <td><OvrBadge value={ovr} size="sm" /></td>
                <td className="tabular-nums text-slate-400">{p.potential}</td>
                <td className="w-24"><Bar value={p.status.fitness} /></td>
                <td className="tabular-nums">{apps}</td>
                <td className="tabular-nums">{goals}</td>
                <td className="tabular-nums">{assists}</td>
                <td className="tabular-nums">{rating ? rating.toFixed(2) : '-'}</td>
                <td className="text-xs tabular-nums text-slate-400">{p.contract.endDate.slice(0, 4)}</td>
                <td>{status(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* 모바일 카드 */}
      <div className="grid gap-2 md:hidden">
        {rows.map(({ p, ovr, age, apps, goals, assists }) => (
          <Link key={p.id} to={`/game/player/${p.id}`} className="panel flex items-center gap-3 p-2.5">
            <PlayerPhoto player={p} className="h-12 w-10 rounded" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">#{p.shirtNumber}</span><span className="truncate font-semibold text-white">{p.name}</span>{status(p)}</div>
              <div className="text-xs text-slate-400">{p.positions[0]} · {age}세 · {apps}경기 {goals}골 {assists}도움</div>
              <div className="mt-1 w-24"><Bar value={p.status.fitness} /></div>
            </div>
            <OvrBadge value={ovr} />
          </Link>
        ))}
      </div>
    </div>
  );
}
