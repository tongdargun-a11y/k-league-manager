import { userPlayerOf } from '../../engine/player/userPlayer';
import { playerOvr } from '../../engine/ratings/ovr';
import { Link, useNavigate } from 'react-router-dom';
import { capsOf } from '../../engine/modes';
import { AlertTriangle, Bell, CalendarClock, HeartPulse, Swords, Trophy, Users } from 'lucide-react';
import { PlayerPhoto } from '../../components/PlayerPhoto';
import { pickBestLineup } from '../../engine/match/lineup';
import { FORMATIONS } from '../../engine/tactics/formations';
import { clubState } from '../../engine/club/facilities';
import { isHomeNation } from '../../data';
import { ageOn } from '../../utils/date';
import { useGame, useWorld } from '../../store/gameStore';
import { fixtureFor, nextFixture, seasonStatsKey, standingsOf } from '../../engine/world';
import { validateLineup } from '../../engine/match/lineup';
import { startNextSeason } from '../../engine/season/rollover';
import { ClubBadge } from '../../components/ClubBadge';
import { EmptyState, FormDots, Panel, Stat } from '../../components/ui';
import { diffDays, formatKorean, formatShort } from '../../utils/date';

export function DashboardPage() {
  const world = useWorld();
  const navigate = useNavigate();
  const startMatch = useGame((s) => s.startMatch);
  const toast = useGame((s) => s.toast);
  const live = useGame((s) => s.live);
  const clubId = world.userClubId;
  const club = world.clubs[clubId];
  const table = standingsOf(world);
  const myRank = table.findIndex((r) => r.clubId === clubId) + 1;
  const myRow = table[myRank - 1];
  const today = fixtureFor(world, world.clock.gameDate, clubId);
  const isMatchDay = !!today && today.status !== 'played';
  const next = nextFixture(world, clubId);
  const recent = world.fixtures
    .filter((f) => f.status === 'played' && (f.homeClubId === clubId || f.awayClubId === clubId))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 5);
  const myPlayers = Object.values(world.players).filter((p) => p.clubId === clubId);
  const injured = myPlayers.filter((p) => p.status.injuryId);
  const suspended = myPlayers.filter((p) => p.status.suspendedMatches > 0);
  const me = userPlayerOf(world);
  const myStats = me ? world.seasonStats[seasonStatsKey(world.season.id, me.id, me.clubId)] : undefined;
  const auto = capsOf(world).autoMatch;
  const lineup = auto || !world.userLineup.starters.length
    ? pickBestLineup(clubId, world.players, world.tactics[clubId]?.formation ?? '4-4-2', world.competition.format.benchSize)
    : world.userLineup;
  const squadRows = myPlayers
    .map((p) => ({ p, ovr: playerOvr(p), st: world.seasonStats[seasonStatsKey(world.season.id, p.id, p.clubId)], role: lineup.starters.includes(p.id) ? '주전' : lineup.bench.includes(p.id) ? '교체' : '명단 외' }))
    .sort((a, b) => (a.role === b.role ? b.ovr - a.ovr : ['주전', '교체', '명단 외'].indexOf(a.role) - ['주전', '교체', '명단 외'].indexOf(b.role)))
    .slice(0, 16);
  const foreignCount = myPlayers.filter((p) => !isHomeNation(p.nationality)).length;
  const expiring = myPlayers.filter((p) => diffDays(p.contract.endDate, world.clock.gameDate) <= 90).length;
  const nearBan = myPlayers.filter((p) => p.status.suspendedMatches === 0 && p.status.yellowCards === world.competition.format.yellowCardsForSuspension - 1);
  const tired = myPlayers.filter((p) => !p.status.injuryId && p.status.fitness < 70).length;
  const avgMorale = Math.round(myPlayers.reduce((sum, p) => sum + p.status.morale, 0) / Math.max(1, myPlayers.length));
  const cst = clubState(world);
  const nextOpp = next ? (next.homeClubId === clubId ? next.awayClubId : next.homeClubId) : null;
  const oppRank = nextOpp ? table.findIndex((r) => r.clubId === nextOpp) + 1 : 0;
  const oppRow = nextOpp ? table[oppRank - 1] : undefined;
  const lineupErrors = validateLineup(world.userLineup, world.players, world.competition.format.benchSize).filter((i) => i.level === 'error');

  const onStart = () => {
    const r = startMatch();
    if (!r.ok) {
      toast(r.reason ?? '경기를 시작할 수 없습니다.', 'warn');
      if (lineupErrors.length) navigate('/game/tactics');
      return;
    }
    navigate('/game/match');
  };

  const opp = (f: typeof next) => (f ? world.clubs[f.homeClubId === clubId ? f.awayClubId : f.homeClubId] : undefined);

  return (
    <div className="space-y-4">
      {(isMatchDay || live) && capsOf(world).liveMatch && (
        <div className="panel flex flex-wrap items-center gap-4 border-gold-500/70 bg-gradient-to-r from-navy-800 to-navy-850 p-4">
          <Swords className="text-gold-400" />
          <div className="flex-1">
            <div className="font-bold text-white">{live ? '경기가 진행 중입니다' : `오늘은 경기일입니다 — vs ${opp(today)?.name}`}</div>
            <div className="text-sm text-slate-400">{live ? '경기 화면으로 돌아가 경기를 마무리하세요.' : '라인업을 확인한 뒤 경기를 시작하세요. 경기 중에는 날짜가 진행되지 않습니다.'}</div>
          </div>
          {lineupErrors.length > 0 && !live && (
            <Link to="/game/tactics" className="flex items-center gap-1 text-sm text-gold-300 underline"><AlertTriangle size={14} /> 라인업 확인 필요</Link>
          )}
          <button className="btn-gold px-5 py-2.5" onClick={() => (live ? navigate('/game/match') : onStart())}>{live ? '경기로 이동' : '경기 시작'}</button>
        </div>
      )}

      {world.incomingOffers.some((o) => o.status === 'pending') && (
        <Link to="/game/transfers" className="panel flex items-center gap-3 border-sky-400/50 p-3 text-sm hover:bg-navy-800">
          <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs font-bold text-sky-300">이적 제안</span>
          <span className="flex-1">답변을 기다리는 이적 제안이 {world.incomingOffers.filter((o) => o.status === 'pending').length}건 있습니다.</span>
          <span className="text-gold-400">확인 →</span>
        </Link>
      )}

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-6 lg:row-span-2" title={<span className="flex items-center gap-2"><Users size={14} /> {club.name} · 선수 {myPlayers.length}명</span>} action={<Link className="text-xs text-gold-400 hover:underline" to="/game/squad">전체</Link>}>
          <div className="mb-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full border border-navy-600 px-2 py-0.5 text-slate-300">외국인 {foreignCount}/{world.competition.format.maxForeignPlayers}</span>
            {expiring > 0 && <span className="rounded-full border border-gold-500/40 px-2 py-0.5 text-gold-300">계약 만료 임박 {expiring}</span>}
            <span className="rounded-full border border-navy-600 px-2 py-0.5 text-slate-300">포메이션 {lineup.formation}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm tabular-nums" data-testid="dash-squad">
              <thead><tr className="border-b border-navy-700 text-left text-[11px] text-slate-400"><th className="py-1 font-medium">선수</th><th className="font-medium">포지션</th><th className="font-medium">나이</th><th className="font-medium">국적</th><th className="font-medium">OVR</th><th className="font-medium">출장</th><th className="font-medium">평점</th><th className="font-medium">역할</th></tr></thead>
              <tbody>
                {squadRows.map(({ p, ovr, st, role }) => {
                  const avg = st && st.ratingCount ? st.ratingSum / st.ratingCount : null;
                  return (
                    <tr key={p.id} className="border-b border-navy-800 hover:bg-navy-800/60">
                      <td className="py-1"><Link to={`/game/player/${p.id}`} className="flex items-center gap-2 hover:text-gold-300"><PlayerPhoto player={p} className="h-7 w-6 shrink-0 rounded" /><span className={`truncate font-medium ${p.status.injuryId ? 'text-rose-300' : 'text-white'}`}>{p.name}</span></Link></td>
                      <td className="text-slate-400">{p.positions.join(' · ')}</td>
                      <td>{ageOn(p.birthDate, world.clock.gameDate)}</td>
                      <td className="text-slate-300">{p.nationality}</td>
                      <td className="font-semibold">{ovr}</td>
                      <td>{st ? st.starts : 0}{st && st.appearances > st.starts ? ` (${st.appearances - st.starts})` : ''}</td>
                      <td><span className={`inline-block min-w-[38px] rounded-full px-1.5 text-center text-[11px] ${avg == null ? 'bg-navy-700 text-slate-400' : avg >= 7 ? 'bg-emerald-500/15 text-emerald-300' : avg >= 6.5 ? 'bg-gold-500/15 text-gold-300' : 'bg-rose-500/15 text-rose-300'}`}>{avg == null ? '-' : avg.toFixed(2)}</span></td>
                      <td><span className={`rounded px-1.5 text-[10px] ${role === '주전' ? 'bg-emerald-500/15 text-emerald-300' : role === '교체' ? 'bg-sky-500/15 text-sky-300' : 'bg-navy-700 text-slate-400'}`}>{role}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="lg:col-span-3" title="전술" action={capsOf(world).tactics ? <Link className="text-xs text-gold-400 hover:underline" to="/game/tactics">편집</Link> : undefined}>
          <div className="mb-1.5 flex justify-between text-xs text-slate-400"><span>포메이션 <b className="text-white">{lineup.formation}</b></span><span>{capsOf(world).autoMatch ? 'AI 감독 선발' : '내 선발'}</span></div>
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-lg border border-emerald-800 bg-[repeating-linear-gradient(180deg,#1b5e45_0_12.5%,#1a5741_12.5%_25%)]" data-testid="dash-pitch">
            <div className="absolute inset-x-0 top-1/2 border-t border-white/25" />
            {FORMATIONS[lineup.formation].map((slot, k) => {
              const pl = world.players[lineup.starters[k]];
              return (
                <div key={k} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 text-[10px]" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
                  <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-navy-950 bg-gold-400 text-[9px] font-bold text-navy-950">{pl?.shirtNumber ?? '-'}</span>
                  <span className="max-w-[64px] truncate rounded bg-navy-950/80 px-1">{pl?.name ?? slot.position}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="lg:col-span-3" title={<span className="flex items-center gap-2"><CalendarClock size={14} /> 다음 경기{next ? ` · ${next.round}R` : ''}</span>}>
          {next ? (
            <div>
              <div className="my-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                <div className="flex flex-col items-center gap-1"><ClubBadge club={world.clubs[next.homeClubId]} size={42} /><span className="text-xs font-semibold">{world.clubs[next.homeClubId].shortName}</span></div>
                <div className="text-xl font-black text-gold-400">VS</div>
                <div className="flex flex-col items-center gap-1"><ClubBadge club={world.clubs[next.awayClubId]} size={42} /><span className="text-xs font-semibold">{world.clubs[next.awayClubId].shortName}</span></div>
              </div>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-400">일시</dt><dd className="text-right">{formatShort(next.date)} · {next.homeClubId === clubId ? '홈' : '원정'} · {diffDays(next.date, world.clock.gameDate) === 0 ? '오늘' : `D-${diffDays(next.date, world.clock.gameDate)}`}</dd>
                <dt className="text-slate-400">상대 순위</dt><dd className="text-right">{oppRank}위 · {oppRow?.points ?? 0}점</dd>
                <dt className="text-slate-400">상대 최근</dt><dd className="flex justify-end">{oppRow && oppRow.form.length ? <FormDots form={oppRow.form} /> : '-'}</dd>
                <dt className="text-slate-400">우리 최근</dt><dd className="flex justify-end">{myRow.form.length ? <FormDots form={myRow.form} /> : '-'}</dd>
                <dt className="text-slate-400">경기장</dt><dd className="truncate text-right">{world.clubs[next.homeClubId].stadium}</dd>
              </dl>
            </div>
          ) : (
            <EmptyState title="남은 경기가 없습니다">
              시즌이 종료되었습니다.
              {world.season.status === 'finished' && (
                <button className="btn-gold mx-auto mt-3" onClick={() => {
                  useGame.getState().mutate(startNextSeason);
                  void useGame.getState().saveGame({ silent: true });
                  toast('새 시즌을 시작했습니다. 받은 메시지에서 은퇴·유소년 소식을 확인하세요.', 'success');
                }}>다음 시즌 시작</button>
              )}
            </EmptyState>
          )}
        </Panel>

        <Panel className="lg:col-span-3" title={<span className="flex items-center gap-2"><Trophy size={14} /> 리그 순위</span>} action={<Link className="text-xs text-gold-400 hover:underline" to="/game/standings">전체</Link>}>
          <ol className="space-y-0.5 text-sm">
            {table.slice(0, 5).map((r, k) => (
              <li key={r.clubId} className={`flex items-center gap-2 rounded px-1.5 py-1 ${r.clubId === clubId ? 'bg-navy-700 font-bold text-gold-300' : ''}`}>
                <span className="w-5 text-right tabular-nums text-slate-400">{k + 1}</span>
                <ClubBadge club={world.clubs[r.clubId]} size={18} />
                <span className="flex-1 truncate">{world.clubs[r.clubId].shortName}</span>
                <span className="w-8 text-right tabular-nums">{r.points}</span>
              </li>
            ))}
            {myRank > 5 && (
              <li className="flex items-center gap-2 rounded bg-navy-700 px-1.5 py-1 font-bold text-gold-300">
                <span className="w-5 text-right tabular-nums">{myRank}</span><ClubBadge club={club} size={18} /><span className="flex-1 truncate">{club.shortName}</span><span className="w-8 text-right tabular-nums">{myRow.points}</span>
              </li>
            )}
          </ol>
          <div className="mt-2 border-t border-navy-700 pt-2 text-[11px] text-slate-400">{myRow.won}승 {myRow.drawn}무 {myRow.lost}패 · 득실 {myRow.goalsFor}:{myRow.goalsAgainst}</div>
        </Panel>

        <Panel className="lg:col-span-3" title={me ? '내 선수' : '시즌 현황'}>
          {me ? (
            <Link to={`/game/player/${me.id}`}><Stat label={me.name} value={`OVR ${playerOvr(me)}`} sub={`잠재력 ${me.potential} · 이번 시즌 ${myStats?.appearances ?? 0}경기 ${myStats?.goals ?? 0}골`} /></Link>
          ) : (
            <div className="space-y-2">
              <Stat label="게임 날짜" value={<span className="text-base">{formatKorean(world.clock.gameDate)}</span>} sub={world.season.label} />
              <div className="text-xs text-slate-400">감독 통산 <b className="text-white">{world.manager.record.won}승 {world.manager.record.drawn}무 {world.manager.record.lost}패</b> · 우승 {world.manager.record.trophies}회</div>
            </div>
          )}
          <ul className="mt-3 space-y-1.5 border-t border-navy-700 pt-2 text-xs">
            <li className="flex justify-between"><span className="text-slate-400">선수단 평균 사기</span><span className={avgMorale >= 65 ? 'text-emerald-300' : avgMorale >= 50 ? 'text-gold-300' : 'text-rose-300'}>{avgMorale}</span></li>
            {cst && <li className="flex justify-between"><span className="text-slate-400">팬 만족도</span><span className={cst.fanSatisfaction >= 65 ? 'text-emerald-300' : cst.fanSatisfaction >= 45 ? 'text-gold-300' : 'text-rose-300'}>{cst.fanSatisfaction}</span></li>}
            {cst && <li className="flex justify-between"><span className="text-slate-400">시설 (경기장·훈련장·유소년)</span><span>{cst.facilities.stadium}·{cst.facilities.training}·{cst.facilities.youth}</span></li>}
          </ul>
        </Panel>

        <Panel className="lg:col-span-3" title={<span className="flex items-center gap-2"><HeartPulse size={14} /> 의료실</span>}>
          <div className="mb-2 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-rose-500/20 font-bold text-rose-300">+</span><span className="text-lg font-bold">부상 {injured.length}명</span></div>
          {injured.length === 0 ? <p className="text-xs text-slate-400">부상자가 없습니다.</p> : (
            <ul className="space-y-1.5 text-sm">
              {injured.map((p) => {
                const inj = world.injuries.find((x) => x.id === p.status.injuryId);
                return <li key={p.id} className="flex items-center gap-2"><Link to={`/game/player/${p.id}`} className="flex-1 truncate text-rose-300 hover:underline">{p.name}</Link><span className="text-[11px] text-slate-400">{inj ? `${inj.type} · ~${formatShort(inj.expectedReturnDate)}` : ''}</span></li>;
              })}
            </ul>
          )}
          {tired > 0 && <div className="mt-2 border-t border-navy-700 pt-2 text-[11px] text-slate-400">체력 70% 미만 {tired}명</div>}
        </Panel>

        <Panel className="lg:col-span-3" title="징계">
          {suspended.length + nearBan.length === 0 ? <p className="text-xs text-slate-400">징계 중이거나 위험한 선수가 없습니다.</p> : (
            <ul className="space-y-1.5 text-sm">
              {suspended.map((p) => <li key={p.id} className="flex items-center gap-2"><span className="h-4 w-3 shrink-0 -rotate-6 rounded-sm bg-rose-500" aria-hidden="true" /><Link to={`/game/player/${p.id}`} className="flex-1 truncate hover:text-gold-300">{p.name}</Link><span className="text-[11px] text-slate-400">출전 정지 {p.status.suspendedMatches}경기</span></li>)}
              {nearBan.map((p) => <li key={p.id} className="flex items-center gap-2"><span className="h-4 w-3 shrink-0 -rotate-6 rounded-sm bg-gold-400" aria-hidden="true" /><Link to={`/game/player/${p.id}`} className="flex-1 truncate hover:text-gold-300">{p.name}</Link><span className="text-[11px] text-slate-400">경고 {p.status.yellowCards}장 · 1장 더 받으면 정지</span></li>)}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-3" title="최근 경기">
          {recent.length === 0 ? <EmptyState title="아직 치른 경기가 없습니다" /> : (
            <ul className="space-y-1.5">
              {recent.map((f) => {
                const home = f.homeClubId === clubId;
                const gf = home ? f.result!.homeGoals : f.result!.awayGoals;
                const ga = home ? f.result!.awayGoals : f.result!.homeGoals;
                const r = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
                return (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <FormDots form={[r]} />
                    <span className="text-xs text-slate-400">{formatShort(f.date)}</span>
                    <span className="flex-1 truncate">{home ? 'vs' : '@'} {opp(f)?.shortName}</span>
                    <span className="font-bold tabular-nums">{gf} : {ga}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel className="lg:col-span-3" title={<span className="flex items-center gap-2"><Bell size={14} /> 받은 메시지</span>}>
          {world.inbox.length === 0 ? <EmptyState title="새 알림이 없습니다" /> : (
            <ul className="grid max-h-72 gap-2 overflow-y-auto pr-1">
              {world.inbox.slice(0, 6).map((m) => (
                <li key={m.id} className="rounded-lg border border-navy-700 bg-navy-900 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-white">{m.title}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatShort(m.date)}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
