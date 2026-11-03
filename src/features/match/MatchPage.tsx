import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRightLeft, FastForward, Pause, Play, Star, Trophy } from 'lucide-react';
import { useGame, useWorld, type LiveSpeed } from '../../store/gameStore';
import { canSubstitute, displayMinute, teamStrength, type MatchState, type SideKey } from '../../engine/match/engine';
import { buildReport } from '../../engine/match/engine';
import { fixtureFor } from '../../engine/world';
import { effectiveRating, playerOvr } from '../../engine/ratings/ovr';
import { ClubBadge } from '../../components/ClubBadge';
import { Bar, EmptyState, Panel, Segmented } from '../../components/ui';
import { TacticControls, PresetPicker } from '../tactics/TacticControls';
import { Pitch } from '../tactics/TacticsPage';
import type { MatchEvent, Player, Tactic } from '../../types';

const LIVE_INTERVAL: Record<LiveSpeed, number> = { slow: 900, normal: 380, fast: 110 };

export function MatchPage() {
  const world = useWorld();
  const live = useGame((s) => s.live);
  const startMatch = useGame((s) => s.startMatch);
  const toast = useGame((s) => s.toast);
  const navigate = useNavigate();

  if (!live) {
    const today = fixtureFor(world, world.clock.gameDate, world.userClubId);
    const lastPlayed = world.fixtures
      .filter((f) => f.status === 'played' && (f.homeClubId === world.userClubId || f.awayClubId === world.userClubId))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-black text-white">경기</h1>
        {today && today.status !== 'played' ? (
          <Panel>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <div className="font-bold text-white">오늘 경기: {world.clubs[today.homeClubId].name} vs {world.clubs[today.awayClubId].name}</div>
                <div className="text-sm text-slate-400">라인업과 전술을 확인한 뒤 경기를 시작하세요.</div>
              </div>
              <Link to="/game/tactics" className="btn-ghost">라인업 확인</Link>
              <button className="btn-gold" onClick={() => { const r = startMatch(); if (!r.ok) toast(r.reason ?? '시작할 수 없습니다.', 'warn'); }}>경기 시작</button>
            </div>
          </Panel>
        ) : (
          <EmptyState title="진행 중인 경기가 없습니다">
            다음 경기일까지 날짜를 진행하세요. <button className="text-gold-400 underline" onClick={() => navigate('/game')}>대시보드로</button>
          </EmptyState>
        )}
        {lastPlayed && world.reports[lastPlayed.id] && <PastReport fixtureId={lastPlayed.id} />}
      </div>
    );
  }
  return <LiveMatch state={live} />;
}

function LiveMatch({ state }: { state: MatchState }) {
  const world = useWorld();
  const running = useGame((s) => s.liveRunning);
  const speed = useGame((s) => s.liveSpeed);
  const setRunning = useGame((s) => s.setLiveRunning);
  const setSpeed = useGame((s) => s.setLiveSpeed);
  const step = useGame((s) => s.matchStep);
  const simulateRest = useGame((s) => s.simulateRest);
  const finish = useGame((s) => s.finishMatch);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'log' | 'subs' | 'tactics' | 'stats'>('log');
  const userSide: SideKey = state.home.isUser ? 'home' : 'away';
  const home = world.clubs[state.home.clubId];
  const away = world.clubs[state.away.clubId];

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => step(), LIVE_INTERVAL[speed]);
    return () => clearInterval(t);
  }, [running, speed, step]);

  const phaseLabel = { pre: '경기 전', first: '전반', halftime: '하프타임', second: '후반', finished: '경기 종료' }[state.phase];

  return (
    <div className="space-y-4">
      {/* 스코어보드 */}
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 items-center justify-end gap-3 text-right">
            <span className="hidden text-lg font-bold text-white sm:block">{home.name}</span>
            <span className="text-lg font-bold text-white sm:hidden">{home.shortName}</span>
            <ClubBadge club={home} size={44} />
          </div>
          <div className="px-3 text-center">
            <div className="text-4xl font-black tabular-nums text-white">{state.score.home} <span className="text-slate-500">:</span> {state.score.away}</div>
            <div className="mt-1 text-sm font-semibold text-gold-400">{state.phase === 'pre' ? '킥오프 전' : state.phase === 'finished' ? '종료' : `${displayMinute(state)}′`} · {phaseLabel}</div>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <ClubBadge club={away} size={44} />
            <span className="hidden text-lg font-bold text-white sm:block">{away.name}</span>
            <span className="text-lg font-bold text-white sm:hidden">{away.shortName}</span>
          </div>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-navy-700">
          <div className="h-full bg-gold-500 transition-all" style={{ width: `${state.phase === 'finished' ? 100 : Math.min(100, (state.minute / (90 + state.addedSecond)) * 100)}%` }} />
        </div>
        <ScorerLine events={state.events} players={world.players} homeId={state.home.clubId} />

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {state.phase !== 'finished' ? (
            <>
              <button className="btn-gold min-w-[110px]" onClick={() => setRunning(!running)}>
                {running ? <><Pause size={16} /> 일시정지</> : <><Play size={16} /> {state.phase === 'pre' ? '킥오프' : state.phase === 'halftime' ? '후반 시작' : '재개'}</>}
              </button>
              <Segmented size="sm" value={speed} onChange={setSpeed} options={[{ value: 'slow', label: '느리게' }, { value: 'normal', label: '보통' }, { value: 'fast', label: '빠르게' }]} />
              <button className="btn-ghost" onClick={() => { if (window.confirm('남은 시간을 바로 진행할까요? 부상 선수만 자동 교체되고, 그 외 개입은 할 수 없습니다.')) simulateRest(); }}>
                <FastForward size={16} /> 결과까지 진행
              </button>
            </>
          ) : (
            <button className="btn-gold px-6" onClick={() => { finish(); navigate('/game'); }}><Trophy size={16} /> 결과 반영하고 계속</button>
          )}
        </div>
        {state.phase === 'halftime' && <p className="mt-2 text-center text-sm text-gold-300">하프타임입니다. 교체·전술 변경을 하고 후반을 시작하세요. (하프타임 교체는 교체 기회를 소모하지 않습니다)</p>}
      </div>

      {state.phase === 'finished' ? (
        <FinishedSummary state={state} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Segmented value={tab} onChange={setTab} options={[{ value: 'log', label: '중계' }, { value: 'subs', label: `교체 (${state[userSide].subsUsed}/${state.maxSubs})` }, { value: 'tactics', label: '전술' }, { value: 'stats', label: '기록' }]} />
            </div>
            {tab === 'log' && <EventLog state={state} />}
            {tab === 'subs' && <SubsPanel state={state} side={userSide} />}
            {tab === 'tactics' && <LiveTactics state={state} side={userSide} />}
            {tab === 'stats' && <StatsPanel state={state} />}
          </div>
          <div className="space-y-4">
            <Panel title="우리 팀">
              <Pitch
                lineup={{ formation: state[userSide].tactic.formation, starters: state[userSide].slots.map((s) => s.playerId) }}
                players={world.players}
                highlight={(id) => {
                  const l = state.live[id];
                  return l ? `${Math.round(l.fitness)}%${l.yellow ? ' 🟨' : ''}${l.injured ? ' 🚑' : ''}` : null;
                }}
              />
            </Panel>
            <StrengthPanel state={state} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScorerLine({ events, players, homeId }: { events: MatchEvent[]; players: Record<string, Player>; homeId: string }) {
  const goals = events.filter((e) => e.type === 'goal' || e.type === 'red');
  if (!goals.length) return null;
  const line = (home: boolean) => goals.filter((e) => (e.clubId === homeId) === home).map((e) => `${e.type === 'red' ? '🟥 ' : ''}${players[e.playerId!]?.name ?? ''} ${e.minute}′`).join(', ');
  return (
    <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-slate-300">
      <div className="text-right">{line(true)}</div>
      <div>{line(false)}</div>
    </div>
  );
}

function EventLog({ state }: { state: MatchState }) {
  const world = useWorld();
  const secondHalfIdx = state.events.findIndex((e) => e.type === 'second-half');
  const events = state.events.map((e, i) => ({ e, phase: (secondHalfIdx === -1 || i < secondHalfIdx ? 'first' : 'second') as MatchState['phase'] })).reverse();
  const color = (e: MatchEvent) =>
    e.type === 'goal' ? 'border-gold-500 bg-gold-500/10 text-gold-100'
    : e.type === 'red' ? 'border-rose-500 bg-rose-500/10'
    : e.type === 'yellow' ? 'border-yellow-400/60'
    : e.type === 'injury' ? 'border-rose-400/60'
    : e.type === 'substitution' || e.type === 'tactic-change' ? 'border-sky-400/50'
    : 'border-navy-700';
  return (
    <Panel className="max-h-[520px] overflow-y-auto">
      {events.length === 0 ? <p className="text-sm text-slate-400">킥오프를 누르면 경기가 시작됩니다.</p> : (
        <ol className="space-y-1.5">
          {events.map(({ e, phase }) => (
            <li key={e.id} className={`flex gap-3 rounded border-l-2 px-2 py-1 text-sm ${color(e)}`}>
              <span className="w-10 shrink-0 text-right font-mono text-xs text-slate-400">{e.minute > 0 ? `${displayMinute({ minute: e.minute, phase }, e.minute)}′` : ''}</span>
              <span className="flex-1">{e.clubId && <span className="mr-1 text-[10px] text-slate-500">[{world.clubs[e.clubId].shortName}]</span>}{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function SubsPanel({ state, side }: { state: MatchState; side: SideKey }) {
  const world = useWorld();
  const sub = useGame((s) => s.matchSubstitute);
  const toast = useGame((s) => s.toast);
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const s = state[side];
  const onPitch = s.slots.filter((x) => x.playerId);
  const outSlot = onPitch.find((x) => x.playerId === outId);
  const check = outId && inId ? canSubstitute(state, side, outId, inId) : null;

  const confirm = () => {
    if (!outId || !inId) return;
    const r = sub(outId, inId);
    if (!r.ok) toast(r.reason ?? '교체할 수 없습니다.', 'warn');
    else { toast(`교체 완료: ${world.players[inId].name} IN`, 'success'); setOutId(null); setInId(null); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">교체 {s.subsUsed}/{state.maxSubs}회 · 교체 기회 {s.windowsUsed}/{state.maxWindows}회 (같은 시간에 여러 명 교체는 1회로 계산)</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="1. 나갈 선수">
          <ul className="space-y-1">
            {onPitch.map(({ playerId, position }) => {
              const p = world.players[playerId!];
              const l = state.live[playerId!];
              return (
                <li key={playerId}>
                  <button onClick={() => setOutId(playerId)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${outId === playerId ? 'bg-gold-500/20 ring-1 ring-gold-500' : 'hover:bg-navy-700'}`}>
                    <span className="w-8 text-[10px] text-slate-400">{position}</span>
                    <span className="flex-1 truncate">{p.name} {l.yellow > 0 && '🟨'} {l.injured && <span className="text-rose-300">🚑 부상</span>}</span>
                    <span className="w-16"><Bar value={l.fitness} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="2. 들어갈 선수">
          {s.bench.length === 0 ? <p className="text-sm text-slate-500">남은 교체 선수가 없습니다.</p> : (
            <ul className="space-y-1">
              {s.bench.map((id) => {
                const p = world.players[id];
                const val = outSlot ? Math.round(effectiveRating(p, outSlot.position)) : playerOvr(p);
                return (
                  <li key={id}>
                    <button onClick={() => setInId(id)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${inId === id ? 'bg-gold-500/20 ring-1 ring-gold-500' : 'hover:bg-navy-700'}`}>
                      <span className="w-8 text-[10px] text-slate-400">{p.positions[0]}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs font-bold text-gold-400" title={outSlot ? `${outSlot.position} 자리 기준 능력` : 'OVR'}>{val}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-gold" disabled={!check?.ok} onClick={confirm}><ArrowRightLeft size={16} /> 교체 확정</button>
        {check && !check.ok && <span className="text-sm text-rose-300">{check.reason}</span>}
        {outId && inId && check?.ok && <span className="text-sm text-slate-300">{world.players[outId].name} OUT → {world.players[inId].name} IN</span>}
      </div>
    </div>
  );
}

function LiveTactics({ state, side }: { state: MatchState; side: SideKey }) {
  const change = useGame((s) => s.matchChangeTactic);
  const toast = useGame((s) => s.toast);
  const [draft, setDraft] = useState<Tactic>(state[side].tactic);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state[side].tactic);
  return (
    <div className="space-y-3">
      <Panel title="프리셋"><PresetPicker tactic={draft} onChange={setDraft} /></Panel>
      <Panel title="전술 지시">
        <TacticControls tactic={draft} onChange={setDraft} />
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-gold" disabled={!dirty} onClick={() => { change(draft); toast('전술 변경이 적용되었습니다.', 'success'); }}>변경 적용</button>
          <button className="btn-ghost" disabled={!dirty} onClick={() => setDraft(state[side].tactic)}>되돌리기</button>
          {draft.formation !== state[side].tactic.formation && <span className="text-xs text-slate-400">포메이션이 바뀌면 선수들이 새 자리에 자동 재배치됩니다.</span>}
        </div>
      </Panel>
    </div>
  );
}

function StatsPanel({ state }: { state: MatchState }) {
  const total = state.possessionTicks.home + state.possessionTicks.away || 1;
  const possHome = state.phase === 'finished' ? state.stats.home.possession : Math.round((state.possessionTicks.home / total) * 100);
  const rows: [string, number | string, number | string][] = [
    ['점유율', `${possHome}%`, `${100 - possHome}%`],
    ['슈팅', state.stats.home.shots, state.stats.away.shots],
    ['유효 슈팅', state.stats.home.shotsOnTarget, state.stats.away.shotsOnTarget],
    ['패스 성공률', pct(state.stats.home.passesCompleted, state.stats.home.passesAttempted), pct(state.stats.away.passesCompleted, state.stats.away.passesAttempted)],
    ['파울', state.stats.home.fouls, state.stats.away.fouls],
    ['경고', state.stats.home.yellows, state.stats.away.yellows],
    ['퇴장', state.stats.home.reds, state.stats.away.reds],
  ];
  return (
    <Panel>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, h, a]) => (
            <tr key={k} className="border-b border-navy-700/60 last:border-0">
              <td className="w-1/3 py-2 text-right font-bold tabular-nums">{h}</td>
              <td className="w-1/3 text-center text-xs text-slate-400">{k}</td>
              <td className="w-1/3 font-bold tabular-nums">{a}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '-');

function StrengthPanel({ state }: { state: MatchState }) {
  const world = useWorld();
  const h = teamStrength(state, 'home', world.players);
  const a = teamStrength(state, 'away', world.players);
  const row = (label: string, x: number, y: number) => {
    const p = (x / (x + y || 1)) * 100;
    return (
      <div key={label}>
        <div className="mb-0.5 flex justify-between text-[11px] text-slate-400"><span>{world.clubs[state.home.clubId].shortName}</span><span>{label}</span><span>{world.clubs[state.away.clubId].shortName}</span></div>
        <div className="flex h-1.5 overflow-hidden rounded bg-navy-700"><div className="bg-gold-500" style={{ width: `${p}%` }} /><div className="flex-1 bg-sky-500/70" /></div>
      </div>
    );
  };
  return (
    <Panel title="실시간 전력 비교">
      <div className="space-y-2">
        {row('공격', h.attack, a.attack)}
        {row('중원', h.midfield, a.midfield)}
        {row('수비', h.defense, a.defense)}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">능력치·포지션 적합도·체력·컨디션·전술을 반영한 현재 전력입니다.</p>
    </Panel>
  );
}

function FinishedSummary({ state }: { state: MatchState }) {
  const world = useWorld();
  const report = useMemo(() => buildReport(state, world.players, true), [state, world.players]);
  return <ReportView report={report} homeId={state.home.clubId} awayId={state.away.clubId} />;
}

function PastReport({ fixtureId }: { fixtureId: string }) {
  const world = useWorld();
  const f = world.fixtures.find((x) => x.id === fixtureId)!;
  return (
    <div className="space-y-2">
      <h2 className="panel-title">지난 경기 · {world.clubs[f.homeClubId].shortName} {f.result!.homeGoals} : {f.result!.awayGoals} {world.clubs[f.awayClubId].shortName}</h2>
      <ReportView report={world.reports[fixtureId]} homeId={f.homeClubId} awayId={f.awayClubId} />
    </div>
  );
}

function ReportView({ report, homeId, awayId }: { report: NonNullable<ReturnType<typeof buildReport>>; homeId: string; awayId: string }) {
  const world = useWorld();
  const mom = report.momPlayerId ? world.players[report.momPlayerId] : null;
  const side = (clubId: string) => report.players.filter((p) => p.clubId === clubId).sort((a, b) => Number(b.started) - Number(a.started) || b.rating - a.rating);
  const stats: [string, string | number, string | number][] = [
    ['점유율', `${report.home.possession}%`, `${report.away.possession}%`],
    ['슈팅 (유효)', `${report.home.shots} (${report.home.shotsOnTarget})`, `${report.away.shots} (${report.away.shotsOnTarget})`],
    ['패스 성공률', pct(report.home.passesCompleted, report.home.passesAttempted), pct(report.away.passesCompleted, report.away.passesAttempted)],
    ['파울', report.home.fouls, report.away.fouls],
    ['경고 / 퇴장', `${report.home.yellows} / ${report.home.reds}`, `${report.away.yellows} / ${report.away.reds}`],
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="경기 기록">
        {mom && <div className="mb-3 flex items-center gap-2 rounded-lg border border-gold-500/50 bg-gold-500/10 p-2 text-sm"><Star size={16} className="text-gold-400" /> MOM <Link className="font-bold text-white hover:underline" to={`/game/player/${mom.id}`}>{mom.name}</Link></div>}
        <table className="w-full text-sm">
          <tbody>
            {stats.map(([k, h, a]) => (
              <tr key={k} className="border-b border-navy-700/60 last:border-0">
                <td className="py-1.5 text-right font-bold tabular-nums">{h}</td><td className="text-center text-xs text-slate-400">{k}</td><td className="font-bold tabular-nums">{a}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {[homeId, awayId].map((cid) => (
        <Panel key={cid} title={`${world.clubs[cid].shortName} 선수 평점`}>
          <ul className="space-y-0.5 text-sm">
            {side(cid).map((p) => (
              <li key={p.playerId} className="flex items-center gap-2">
                <span className={`w-6 text-[10px] ${p.started ? 'text-slate-400' : 'text-sky-300'}`}>{p.started ? '' : '교'}</span>
                <Link to={`/game/player/${p.playerId}`} className="flex-1 truncate hover:underline">{world.players[p.playerId]?.name}</Link>
                <span className="text-xs text-slate-500">{p.minutes}′ {p.goals ? `⚽${p.goals}` : ''}{p.assists ? ` 🅰${p.assists}` : ''}{p.yellow ? ' 🟨' : ''}{p.red ? ' 🟥' : ''}</span>
                <span className={`w-8 text-right font-bold tabular-nums ${p.rating >= 7.5 ? 'text-emerald-300' : p.rating < 6 ? 'text-rose-300' : ''}`}>{p.rating.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

