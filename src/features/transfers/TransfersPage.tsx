import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useGame, useWorld } from '../../store/gameStore';
import { acceptIncomingOffer, currentWindowLabel, isWindowOpen, marketValue, rejectIncomingOffer, squadOf } from '../../engine/transfers/transfers';
import { formatMoney, weeklyWageBill } from '../../engine/finance/finance';
import { playerOvr, positionGroup } from '../../engine/ratings/ovr';
import { ageOn, formatShort } from '../../utils/date';
import { ClubBadge } from '../../components/ClubBadge';
import { OvrBadge, Panel, Segmented, Stat } from '../../components/ui';
import { FREE_AGENT, type PositionGroup } from '../../types';

export function TransfersPage() {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [tab, setTab] = useState<'search' | 'offers' | 'history'>('search');
  const [group, setGroup] = useState<'ALL' | PositionGroup>('ALL');
  const [club, setClub] = useState<string>('all');
  const [minOvr, setMinOvr] = useState(60);
  const [maxAge, setMaxAge] = useState(35);
  const [affordable, setAffordable] = useState(false);
  const [q, setQ] = useState('');
  const today = world.clock.gameDate;
  const me = world.clubs[world.userClubId];
  const open = isWindowOpen(world.competition.format, today);
  const windowLabel = currentWindowLabel(world.competition.format, today);
  const pending = world.incomingOffers.filter((o) => o.status === 'pending');

  const list = useMemo(() => Object.values(world.players)
    .filter((p) => p.clubId !== world.userClubId)
    .filter((p) => club === 'all' || p.clubId === club)
    .filter((p) => group === 'ALL' || positionGroup(p.positions[0]) === group)
    .filter((p) => !q || p.name.includes(q) || (p.nameEn ?? '').toLowerCase().includes(q.toLowerCase()))
    .map((p) => ({ p, ovr: playerOvr(p), age: ageOn(p.birthDate, today), value: marketValue(p, today) }))
    .filter((x) => x.ovr >= minOvr && x.age <= maxAge)
    .filter((x) => !affordable || x.value <= me.finances.transferBudget)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 150), [world.players, world.userClubId, club, group, q, minOvr, maxAge, affordable, me.finances.transferBudget, today]);

  const bill = weeklyWageBill(world.userClubId, world.players);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black text-white">이적시장</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${open ? 'bg-emerald-500/20 text-emerald-300' : 'bg-navy-700 text-slate-400'}`}>
          {open ? `${windowLabel} 진행 중` : '이적시장 마감 (무소속 선수만 영입 가능)'}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Panel><Stat label="이적 예산" value={formatMoney(me.finances.transferBudget)} sub="게임용 추정" /></Panel>
        <Panel><Stat label="주급 총액 / 예산" value={`${formatMoney(bill)} / ${formatMoney(me.finances.wageBudget)}`} sub={`여유 ${formatMoney(me.finances.wageBudget - bill)}`} /></Panel>
        <Panel><Stat label="선수단" value={`${squadOf(world, world.userClubId).length}명`} sub={`최소 ${world.competition.format.minSquadSize} · 최대 ${world.competition.format.maxSquadSize}명`} /></Panel>
      </div>

      <Segmented value={tab} onChange={setTab} options={[{ value: 'search', label: '선수 검색' }, { value: 'offers', label: `받은 제안 (${pending.length})` }, { value: 'history', label: '이적 기록' }]} />

      {tab === 'search' && (
        <>
          <Panel>
            <div className="flex flex-wrap items-end gap-3">
              <Segmented size="sm" value={group} onChange={setGroup} options={[{ value: 'ALL', label: '전체' }, { value: 'GK', label: 'GK' }, { value: 'DF', label: 'DF' }, { value: 'MF', label: 'MF' }, { value: 'FW', label: 'FW' }]} />
              <select className="input w-auto" value={club} onChange={(e) => setClub(e.target.value)} aria-label="구단">
                <option value="all">모든 구단</option>
                <option value={FREE_AGENT}>무소속</option>
                {Object.values(world.clubs).filter((c) => c.id !== world.userClubId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="text-xs text-slate-400">최소 OVR <input type="number" className="input mt-1 w-20" value={minOvr} min={1} max={99} onChange={(e) => setMinOvr(Number(e.target.value) || 1)} /></label>
              <label className="text-xs text-slate-400">최대 나이 <input type="number" className="input mt-1 w-20" value={maxAge} min={15} max={45} onChange={(e) => setMaxAge(Number(e.target.value) || 45)} /></label>
              <input className="input w-40" placeholder="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={affordable} onChange={(e) => setAffordable(e.target.checked)} /> 예산 안의 선수만</label>
            </div>
          </Panel>
          <Panel className="overflow-x-auto p-0">
            <table className="table-base min-w-[640px]">
              <thead><tr><th>이름</th><th>구단</th><th>포지션</th><th>나이</th><th>OVR</th><th>POT</th><th>시장 가치</th><th>계약</th></tr></thead>
              <tbody>
                {list.map(({ p, ovr, age, value }) => (
                  <tr key={p.id} className="hover:bg-navy-800">
                    <td><Link to={`/game/player/${p.id}`} className="font-semibold text-white hover:text-gold-400">{p.name}</Link><div className="text-[11px] text-slate-500">{p.nationality}</div></td>
                    <td>{p.clubId === FREE_AGENT ? <span className="text-xs text-sky-300">무소속</span> : <span className="flex items-center gap-1.5 text-xs"><ClubBadge club={world.clubs[p.clubId]} size={18} />{world.clubs[p.clubId].shortName}</span>}</td>
                    <td className="text-xs">{p.positions.join(' · ')}</td>
                    <td className="tabular-nums">{age}</td>
                    <td><OvrBadge value={ovr} size="sm" /></td>
                    <td className="tabular-nums text-slate-400">{p.potential}</td>
                    <td className={`tabular-nums ${value > me.finances.transferBudget ? 'text-rose-300' : ''}`}>{p.clubId === FREE_AGENT ? '이적료 없음' : formatMoney(value)}</td>
                    <td className="text-xs text-slate-400">{p.clubId === FREE_AGENT ? '-' : p.contract.endDate.slice(0, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length === 0 && <p className="p-4 text-sm text-slate-400">조건에 맞는 선수가 없습니다.</p>}
          </Panel>
          <p className="text-xs text-slate-500">선수 이름을 누르면 상세 화면에서 영입 제안을 할 수 있습니다. 시장 가치·요구 주급은 게임용 추정치입니다.</p>
        </>
      )}

      {tab === 'offers' && (
        <Panel>
          {world.incomingOffers.length === 0 ? <p className="text-sm text-slate-400">받은 제안이 없습니다. 이적시장 기간에 다른 구단이 제안할 수 있습니다.</p> : (
            <ul className="divide-y divide-navy-700">
              {world.incomingOffers.map((o) => {
                const p = world.players[o.playerId];
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <ClubBadge club={world.clubs[o.fromClubId]} size={26} />
                    <div className="min-w-0 flex-1">
                      <div><b className="text-white">{world.clubs[o.fromClubId].shortName}</b> → <Link to={`/game/player/${p.id}`} className="text-gold-300 hover:underline">{p.name}</Link> ({p.positions[0]}, OVR {playerOvr(p)})</div>
                      <div className="text-xs text-slate-400">제안 {formatMoney(o.fee)} · 시장 가치 {formatMoney(marketValue(p, today))} · {formatShort(o.date)} ~ {formatShort(o.expiresOn)}</div>
                    </div>
                    {o.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button className="btn-gold px-3 py-1.5" onClick={() => {
                          if (!window.confirm(`${p.name} 선수를 ${formatMoney(o.fee)}에 ${world.clubs[o.fromClubId].name}(으)로 보낼까요? 되돌릴 수 없습니다.`)) return;
                          mutate((w) => acceptIncomingOffer(w, o.id));
                          toast(`${p.name} 이적 완료. 이적료 ${formatMoney(o.fee)} 입금.`, 'success');
                        }}><Check size={14} /> 수락</button>
                        <button className="btn-ghost px-3 py-1.5" onClick={() => mutate((w) => rejectIncomingOffer(w, o.id))}><X size={14} /> 거절</button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{{ accepted: '수락', rejected: '거절', countered: '역제안', withdrawn: '철회', completed: '이적 완료', expired: '기간 만료', pending: '' }[o.status]}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'history' && (
        <Panel>
          {world.transfers.length === 0 ? <p className="text-sm text-slate-400">이번 세이브의 이적 기록이 없습니다.</p> : (
            <ul className="divide-y divide-navy-700 text-sm">
              {world.transfers.map((t) => {
                const p = world.players[t.playerId];
                const name = (id: string) => (id === FREE_AGENT ? '무소속' : world.clubs[id]?.shortName ?? id);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 py-2">
                    <span className="w-16 text-xs text-slate-400">{formatShort(t.date)}</span>
                    <Link to={`/game/player/${t.playerId}`} className="flex-1 truncate text-white hover:underline">{p?.name ?? t.playerId}</Link>
                    <span className="text-xs">{name(t.fromClubId)} → {name(t.toClubId)}</span>
                    <span className="w-24 text-right text-xs tabular-nums">{t.fee ? formatMoney(t.fee) : { free: '자유 계약', release: '방출', 'contract-expired': '계약 만료', transfer: '-' }[t.type]}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
