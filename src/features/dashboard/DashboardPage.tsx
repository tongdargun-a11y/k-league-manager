import { Link, useNavigate } from 'react-router-dom';
import { capsOf } from '../../engine/modes';
import { AlertTriangle, Bell, CalendarClock, HeartPulse, Swords, Trophy } from 'lucide-react';
import { useGame, useWorld } from '../../store/gameStore';
import { fixtureFor, nextFixture, standingsOf } from '../../engine/world';
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

      <div className="grid gap-4 md:grid-cols-4">
        <Panel className="md:col-span-1"><Stat label="게임 날짜" value={<span className="text-lg">{formatKorean(world.clock.gameDate)}</span>} sub={world.season.label} /></Panel>
        <Panel><Stat label="리그 순위" value={`${myRank}위`} sub={`${myRow.points}점 · ${myRow.won}승 ${myRow.drawn}무 ${myRow.lost}패`} /></Panel>
        <Panel><Stat label="득실" value={`${myRow.goalsFor} : ${myRow.goalsAgainst}`} sub={`골득실 ${myRow.goalDifference > 0 ? '+' : ''}${myRow.goalDifference}`} /></Panel>
        <Panel><Stat label="감독 통산" value={`${world.manager.record.won}-${world.manager.record.drawn}-${world.manager.record.lost}`} sub={`${world.manager.record.played}경기 · 우승 ${world.manager.record.trophies}회`} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={<span className="flex items-center gap-2"><CalendarClock size={14} /> 다음 경기</span>} className="lg:col-span-2">
          {next ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-1 items-center justify-center gap-4 sm:gap-8">
                <div className="flex flex-col items-center gap-1 text-center">
                  <ClubBadge club={world.clubs[next.homeClubId]} size={52} />
                  <span className="text-sm font-semibold">{world.clubs[next.homeClubId].shortName}</span>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-400">{next.round}라운드 · {next.homeClubId === clubId ? '홈' : '원정'}</div>
                  <div className="text-2xl font-black text-gold-400">VS</div>
                  <div className="text-xs text-slate-300">{formatShort(next.date)}</div>
                  <div className="text-[11px] text-slate-500">{diffDays(next.date, world.clock.gameDate) === 0 ? '오늘' : `D-${diffDays(next.date, world.clock.gameDate)}`}</div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <ClubBadge club={world.clubs[next.awayClubId]} size={52} />
                  <span className="text-sm font-semibold">{world.clubs[next.awayClubId].shortName}</span>
                </div>
              </div>
              <div className="w-full text-center text-xs text-slate-400 sm:w-auto">{world.clubs[next.homeClubId].stadium}</div>
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

        <Panel title={<span className="flex items-center gap-2"><Trophy size={14} /> 순위 요약</span>} action={<Link className="text-xs text-gold-400 hover:underline" to="/game/standings">전체</Link>}>
          <ol className="space-y-1 text-sm">
            {table.slice(0, 6).map((r, i) => (
              <li key={r.clubId} className={`flex items-center gap-2 rounded px-1.5 py-1 ${r.clubId === clubId ? 'bg-navy-700 text-gold-300' : ''}`}>
                <span className="w-5 text-right tabular-nums text-slate-400">{i + 1}</span>
                <ClubBadge club={world.clubs[r.clubId]} size={20} />
                <span className="flex-1 truncate">{world.clubs[r.clubId].shortName}</span>
                <span className="tabular-nums text-slate-400">{r.played}</span>
                <span className="w-8 text-right font-bold tabular-nums">{r.points}</span>
              </li>
            ))}
            {myRank > 6 && (
              <li className="flex items-center gap-2 rounded bg-navy-700 px-1.5 py-1 text-gold-300">
                <span className="w-5 text-right tabular-nums">{myRank}</span>
                <ClubBadge club={club} size={20} />
                <span className="flex-1 truncate">{club.shortName}</span>
                <span className="tabular-nums text-slate-400">{myRow.played}</span>
                <span className="w-8 text-right font-bold tabular-nums">{myRow.points}</span>
              </li>
            )}
          </ol>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="최근 경기">
          {recent.length === 0 ? <EmptyState title="아직 치른 경기가 없습니다" /> : (
            <ul className="space-y-2">
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
          {myRow.form.length > 0 && <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">최근 폼 <FormDots form={myRow.form} /></div>}
        </Panel>

        <Panel title={<span className="flex items-center gap-2"><HeartPulse size={14} /> 부상·징계</span>}>
          {injured.length + suspended.length === 0 ? <EmptyState title="결장 선수가 없습니다" /> : (
            <ul className="space-y-2 text-sm">
              {injured.map((p) => {
                const inj = world.injuries.find((i) => i.id === p.status.injuryId);
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/20 px-1.5 text-[11px] font-bold text-rose-300">부상</span>
                    <Link to={`/game/player/${p.id}`} className="flex-1 truncate hover:text-gold-400">{p.name}</Link>
                    <span className="text-xs text-slate-400">{inj ? `${inj.type} · ~${formatShort(inj.expectedReturnDate)}` : ''}</span>
                  </li>
                );
              })}
              {suspended.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="rounded bg-gold-500/20 px-1.5 text-[11px] font-bold text-gold-300">징계</span>
                  <Link to={`/game/player/${p.id}`} className="flex-1 truncate hover:text-gold-400">{p.name}</Link>
                  <span className="text-xs text-slate-400">{p.status.suspendedMatches}경기</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={<span className="flex items-center gap-2"><Bell size={14} /> 알림</span>}>
          {world.inbox.length === 0 ? <EmptyState title="새 알림이 없습니다" /> : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {world.inbox.slice(0, 12).map((m) => (
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
