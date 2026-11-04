import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWorld } from '../../store/gameStore';
import { careerStats, currentSeasonStats } from '../../engine/world';
import { ATTRIBUTE_GROUPS, groupAverage, ovrForPosition, POSITION_LABEL } from '../../engine/ratings/ovr';
import { PlayerCard } from './PlayerCard';
import { Bar, EmptyState, Panel } from '../../components/ui';
import { TestDataBadge } from '../../components/TestDataBadge';
import { POSITIONS, FREE_AGENT, RETIRED, type Club } from '../../types';
import { NegotiationPanel, OwnPlayerPanel } from '../transfers/PlayerActions';
import { CareerPanel } from '../player/CareerPanel';
import { userPlayerOf } from '../../engine/player/userPlayer';
import { capsOf } from '../../engine/modes';

const FREE_AGENT_CLUB: Club = { id: FREE_AGENT, name: '무소속', shortName: '무소속', city: '-', stadium: '-', reputation: 0, colors: { primary: '#334155', secondary: '#1e293b' }, crestAssetId: null, finances: { balance: 0, transferBudget: 0, wageBudget: 0 }, meta: { sourceType: 'test', source: '', sourceUpdatedAt: '', licenseStatus: 'none', createdAt: '', updatedAt: '' } };
import { formatShort } from '../../utils/date';

export function PlayerPage() {
  const { id } = useParams();
  const world = useWorld();
  const navigate = useNavigate();
  const player = id ? world.players[id] : undefined;
  if (!player) return <EmptyState title="선수를 찾을 수 없습니다"><Link to="/game/squad" className="text-gold-400 underline">선수단으로</Link></EmptyState>;
  const club = world.clubs[player.clubId] ?? (player.clubId === RETIRED ? { ...FREE_AGENT_CLUB, id: RETIRED, name: '은퇴', shortName: '은퇴' } : FREE_AGENT_CLUB);
  const isMine = player.clubId === world.userClubId;
  const career = careerStats(world, player.id);
  const season = currentSeasonStats(world, player.id);
  const injury = world.injuries.find((i) => i.id === player.status.injuryId);
  const isGK = player.positions[0] === 'GK';
  const topPositions = POSITIONS.map((pos) => ({ pos, ovr: ovrForPosition(player.attributes, pos) })).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
  const recentApps = Object.values(world.reports)
    .map((r) => ({ r, ps: r.players.find((p) => p.playerId === player.id) }))
    .filter((x) => x.ps)
    .map((x) => ({ ...x, f: world.fixtures.find((f) => f.id === x.r.fixtureId)! }))
    .sort((a, b) => (a.f.date < b.f.date ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={16} /> 뒤로</button>
        {player.meta.sourceType === 'test' ? <TestDataBadge text="가상 선수 · 게임용 추정 능력치" /> : <TestDataBadge text={`가져온 데이터 · 능력치 ${player.attributesSource === 'imported' ? '가져온 값' : '게임용 추정치'}`} />}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-2">
          <PlayerCard player={player} club={club} career={career} gameDate={world.clock.gameDate} seasonLabel={(sid) => (sid === world.season.id ? world.season.label : sid)} clubName={(id) => world.clubs[id]?.shortName ?? '무소속'} />
          {/* 개인용 사진 버튼은 숨김 (PHASE 0). 코드: ../images/LocalImageButton */}
        </div>
        <div className="space-y-4">
          <Panel title="상태">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {[['체력', player.status.fitness], ['컨디션', player.status.condition], ['사기', player.status.morale], ['경기 감각', player.status.sharpness]].map(([k, v]) => (
                <div key={k as string}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">{k}</span><span className="tabular-nums">{Math.round(v as number)}</span></div><Bar value={v as number} /></div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {injury && <span className="rounded bg-rose-500/20 px-2 py-0.5 text-rose-300">부상: {injury.type} (복귀 예정 {formatShort(injury.expectedReturnDate)})</span>}
              {player.status.suspendedMatches > 0 && <span className="rounded bg-gold-500/20 px-2 py-0.5 text-gold-300">출전 정지 {player.status.suspendedMatches}경기</span>}
              {player.loan && <span className="rounded bg-sky-500/20 px-2 py-0.5 text-sky-300">임대 중 · 원소속 {world.clubs[player.loan.parentClubId]?.shortName} (~{formatShort(player.loan.until)})</span>}
              <span className="rounded bg-navy-700 px-2 py-0.5 text-slate-300">누적 경고 {player.status.yellowCards}</span>
              <span className="rounded bg-navy-700 px-2 py-0.5 text-slate-300">계약 ~{player.contract.endDate} · 주급 {player.contract.wage.toLocaleString()}만 원(추정)</span>
            </div>
          </Panel>

          {userPlayerOf(world)?.id === player.id && player.clubId !== RETIRED && <CareerPanel player={player} />}
          {userPlayerOf(world)?.id === player.id && player.clubId === RETIRED && (
            <Panel title="은퇴 카드">
              <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4" data-testid="retire-card">
                {[['통산 출전', career.appearances], ['통산 득점', career.goals], ['통산 도움', career.assists], ['최고 OVR', player.peakOvr]].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg bg-navy-900 p-3"><div className="text-2xl font-black text-gold-300">{v}</div><div className="text-xs text-slate-400">{k}</div></div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">우승·수상 {player.honours.length}회. 새 선수로 다시 시작하려면 타이틀에서 새 게임을 만드세요.</p>
            </Panel>
          )}
          {player.clubId === RETIRED ? null : isMine ? <OwnPlayerPanel player={player} /> : capsOf(world).transfers ? <NegotiationPanel key={player.id} player={player} /> : null}

          <Panel title="이번 시즌">
            <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
              {[['출전', season?.appearances ?? 0], ['선발', season?.starts ?? 0], ['출전 시간', `${season?.minutes ?? 0}′`], ['득점', season?.goals ?? 0], ['도움', season?.assists ?? 0], ['경고/퇴장', `${season?.yellowCards ?? 0}/${season?.redCards ?? 0}`]].map(([k, v]) => (
                <div key={k as string}><div className="stat-num text-xl">{v}</div><div className="text-[11px] text-slate-400">{k}</div></div>
              ))}
            </div>
          </Panel>

          <Panel title="능력치 (게임용 추정치)">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {ATTRIBUTE_GROUPS.filter((g) => isGK || g.key !== 'goalkeeping').map((g) => (
                <div key={g.key}>
                  <div className="mb-1.5 flex justify-between text-xs font-semibold"><span className="text-gold-300">{g.label}</span><span className="tabular-nums text-white">{groupAverage(player.attributes, g.key)}</span></div>
                  <ul className="space-y-1">
                    {g.attrs.map((a) => (
                      <li key={a.key} className="flex items-center gap-2 text-xs">
                        <span className="w-16 shrink-0 text-slate-400">{a.label}</span>
                        <div className="flex-1"><Bar value={player.attributes[a.key]} /></div>
                        <span className="w-6 text-right tabular-nums">{player.attributes[a.key]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="포지션별 OVR">
              <ul className="space-y-1 text-sm">
                {topPositions.map(({ pos, ovr }) => (
                  <li key={pos} className="flex items-center justify-between"><span>{POSITION_LABEL[pos]} <span className="text-xs text-slate-500">{pos}{player.positions.includes(pos) ? ' · 익숙함' : ''}</span></span><span className="font-bold tabular-nums">{ovr}</span></li>
                ))}
              </ul>
            </Panel>
            <Panel title="최근 출전">
              {recentApps.length === 0 ? <p className="text-sm text-slate-500">기록 없음</p> : (
                <ul className="space-y-1 text-sm">
                  {recentApps.map(({ f, ps }) => {
                    const oppId = f.homeClubId === ps!.clubId ? f.awayClubId : f.homeClubId;
                    return (
                      <li key={f.id} className="flex items-center gap-2">
                        <span className="w-16 text-xs text-slate-400">{formatShort(f.date)}</span>
                        <span className="flex-1 truncate">vs {world.clubs[oppId].shortName} {f.result!.homeGoals}:{f.result!.awayGoals}</span>
                        <span className="text-xs text-slate-400">{ps!.minutes}′ {ps!.goals ? `⚽${ps!.goals}` : ''}{ps!.assists ? ` 🅰${ps!.assists}` : ''}</span>
                        <span className={`w-9 text-right font-bold tabular-nums ${ps!.rating >= 7.5 ? 'text-emerald-300' : ps!.rating < 6 ? 'text-rose-300' : ''}`}>{ps!.rating.toFixed(1)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
