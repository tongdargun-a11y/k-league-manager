import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Wand2, X } from 'lucide-react';
import { useGame, useWorld } from '../../store/gameStore';
import { FORMATIONS } from '../../engine/tactics/formations';
import { assignToFormation, isAvailable, pickBestLineup, validateLineup } from '../../engine/match/lineup';
import { effectiveRating, fitLabel, playerOvr, positionFit, positionGroup } from '../../engine/ratings/ovr';
import { Bar, OvrBadge, Panel } from '../../components/ui';
import { PresetPicker, TacticControls, tacticHints } from './TacticControls';
import type { Formation, Lineup, Player, Tactic } from '../../types';

type Target = { kind: 'starter'; index: number } | { kind: 'bench'; index: number } | null;

export function TacticsPage() {
  const world = useWorld();
  const setLineup = useGame((s) => s.setLineup);
  const setTactic = useGame((s) => s.setTactic);
  const toast = useGame((s) => s.toast);
  const saveGame = useGame((s) => s.saveGame);
  const live = useGame((s) => s.live);
  const [target, setTarget] = useState<Target>(null);
  const lineup = world.userLineup;
  const tactic = world.tactics[world.userClubId];
  const players = world.players;
  const benchSize = world.competition.format.benchSize;
  const slots = FORMATIONS[lineup.formation];
  const squad = useMemo(() => Object.values(players).filter((p) => p.clubId === world.userClubId).sort((a, b) => playerOvr(b) - playerOvr(a)), [players, world.userClubId]);
  const issues = validateLineup(lineup, players, benchSize);

  const changeFormation = (formation: Formation) => {
    const assigned = assignToFormation(lineup.starters, formation, players).filter((x): x is string => !!x);
    setLineup({ ...lineup, formation, starters: assigned });
    setTactic({ ...tactic, formation });
  };

  const onTacticChange = (t: Tactic) => {
    if (t.formation !== tactic.formation) changeFormation(t.formation);
    else setTactic(t);
  };

  const auto = () => {
    setLineup(pickBestLineup(world.userClubId, players, lineup.formation, benchSize));
    toast('최적 라인업을 자동 구성했습니다.', 'success');
  };

  /** 대상 칸에 선수 배치 (이미 다른 칸에 있으면 서로 교환) */
  const place = (pid: string) => {
    if (!target) return;
    const next: Lineup = { ...lineup, starters: [...lineup.starters], bench: [...lineup.bench] };
    const fromStarter = next.starters.indexOf(pid);
    const fromBench = next.bench.indexOf(pid);
    const current = target.kind === 'starter' ? next.starters[target.index] : next.bench[target.index];
    if (target.kind === 'starter') {
      next.starters[target.index] = pid;
    } else {
      if (target.index >= next.bench.length) next.bench.push(pid);
      else next.bench[target.index] = pid;
    }
    if (fromStarter >= 0 && !(target.kind === 'starter' && fromStarter === target.index)) {
      if (current) next.starters[fromStarter] = current;
      else next.starters.splice(fromStarter, 1);
    }
    if (fromBench >= 0 && !(target.kind === 'bench' && fromBench === target.index)) {
      if (current) next.bench[fromBench] = current;
      else next.bench.splice(fromBench, 1);
    }
    next.bench = next.bench.filter(Boolean);
    setLineup(next);
    setTarget(null);
  };

  const removeFromBench = (i: number) => setLineup({ ...lineup, bench: lineup.bench.filter((_, idx) => idx !== i) });

  const targetPos = target?.kind === 'starter' ? slots[target.index]?.position : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-black text-white">전술·라인업</h1>
        <button className="btn-ghost" onClick={auto}><Wand2 size={16} /> 자동 선발</button>
        <button className="btn-gold" onClick={() => saveGame()}>저장</button>
      </div>
      {live && <p className="rounded-lg border border-gold-500/40 bg-gold-500/10 p-2 text-sm text-gold-200">경기 진행 중입니다. 여기서 바꾼 라인업은 다음 경기부터 적용됩니다. 경기 중 변경은 <Link to="/game/match" className="underline">경기 화면</Link>에서 하세요.</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel title={`선발 11명 · ${lineup.formation}`} action={<span className="text-xs text-slate-400">칸을 누른 뒤 아래 목록에서 선수를 고르세요</span>}>
            <Pitch lineup={lineup} players={players} target={target} onSelect={(i) => setTarget(target?.kind === 'starter' && target.index === i ? null : { kind: 'starter', index: i })} />
          </Panel>

          <Panel title={`벤치 (${lineup.bench.length}/${benchSize})`}>
            <div className="flex flex-wrap gap-2">
              {lineup.bench.map((id, i) => {
                const p = players[id];
                if (!p) return null;
                const sel = target?.kind === 'bench' && target.index === i;
                return (
                  <div key={id} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-sm ${sel ? 'border-gold-500 bg-gold-500/10' : 'border-navy-600 bg-navy-900'}`}>
                    <button onClick={() => setTarget(sel ? null : { kind: 'bench', index: i })} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">{p.positions[0]}</span>
                      <span className={isAvailable(p) ? 'text-white' : 'text-rose-300 line-through'}>{p.name}</span>
                      <span className="text-xs font-bold text-gold-400">{playerOvr(p)}</span>
                    </button>
                    <button className="text-slate-500 hover:text-rose-300" onClick={() => removeFromBench(i)} aria-label={`${p.name} 벤치에서 제외`}><X size={14} /></button>
                  </div>
                );
              })}
              {lineup.bench.length < benchSize && (
                <button onClick={() => setTarget({ kind: 'bench', index: lineup.bench.length })} className={`rounded-lg border border-dashed px-3 py-1 text-sm ${target?.kind === 'bench' && target.index === lineup.bench.length ? 'border-gold-500 text-gold-300' : 'border-navy-600 text-slate-400 hover:text-white'}`}>+ 벤치 추가</button>
              )}
            </div>
          </Panel>

          <Panel title={target ? (target.kind === 'starter' ? `${targetPos} 자리에 넣을 선수 선택` : '벤치에 넣을 선수 선택') : '선수 목록'}>
            <div className="max-h-[420px] overflow-y-auto">
              <table className="table-base">
                <thead><tr><th>이름</th><th>포지션</th><th>OVR</th>{targetPos && <th>적합도</th>}<th className="w-24">체력</th><th>상태</th></tr></thead>
                <tbody>
                  {squad.map((p) => {
                    const inXI = lineup.starters.includes(p.id);
                    const onBench = lineup.bench.includes(p.id);
                    const fit = targetPos ? positionFit(p, targetPos) : null;
                    const fl = fit !== null ? fitLabel(fit) : null;
                    return (
                      <tr key={p.id} className={`${target ? 'cursor-pointer hover:bg-navy-700' : ''}`} onClick={() => target && place(p.id)}>
                        <td className="font-medium text-white">{p.name}</td>
                        <td className="text-xs text-slate-400">{p.positions.join(' · ')}</td>
                        <td><OvrBadge value={targetPos ? Math.round(effectiveRating(p, targetPos)) : playerOvr(p)} size="sm" /></td>
                        {fl && <td className={`text-xs ${fl.tone === 'good' ? 'text-emerald-300' : fl.tone === 'ok' ? 'text-gold-300' : 'text-rose-300'}`}>{fl.label}</td>}
                        <td><Bar value={p.status.fitness} /></td>
                        <td className="text-xs">
                          {p.status.injuryId ? <span className="text-rose-300">부상</span> : p.status.suspendedMatches > 0 ? <span className="text-gold-300">징계</span> : inXI ? <span className="text-emerald-300">선발</span> : onBench ? <span className="text-sky-300">벤치</span> : <span className="text-slate-500">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="라인업 점검">
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={16} /> 경기 준비 완료</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {issues.map((i, k) => <li key={k} className={`flex items-start gap-2 ${i.level === 'error' ? 'text-rose-300' : 'text-gold-300'}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" />{i.message}</li>)}
              </ul>
            )}
          </Panel>
          <Panel title="전술 프리셋"><PresetPicker tactic={tactic} onChange={onTacticChange} /></Panel>
          <Panel title="팀 전술">
            <TacticControls tactic={tactic} onChange={onTacticChange} />
            <div className="mt-3 flex flex-wrap gap-1">{tacticHints(tactic).map((h) => <span key={h} className="rounded bg-navy-700 px-2 py-0.5 text-[11px] text-slate-300">{h}</span>)}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export function Pitch({ lineup, players, target, onSelect, slotsOverride, highlight }: {
  lineup: { formation: Formation; starters: (string | null)[] };
  players: Record<string, Player>;
  target?: Target;
  onSelect?: (index: number) => void;
  slotsOverride?: { position: string; x: number; y: number }[];
  highlight?: (id: string) => string | null;
}) {
  const slots = slotsOverride ?? FORMATIONS[lineup.formation];
  return (
    <div className="relative mx-auto aspect-[68/80] w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/60 bg-gradient-to-b from-emerald-950 to-emerald-900/70">
      <div className="absolute inset-3 rounded border border-white/10" />
      <div className="absolute left-3 right-3 top-1/2 border-t border-white/10" />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      <div className="absolute bottom-3 left-1/2 h-12 w-32 -translate-x-1/2 border border-b-0 border-white/10" />
      <div className="absolute left-1/2 top-3 h-12 w-32 -translate-x-1/2 border border-t-0 border-white/10" />
      {slots.map((s, i) => {
        const id = lineup.starters[i];
        const p = id ? players[id] : undefined;
        const sel = target?.kind === 'starter' && target.index === i;
        const fit = p ? positionFit(p, s.position as Player['positions'][0]) : 1;
        const extra = id && highlight ? highlight(id) : null;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect?.(i)}
            disabled={!onSelect}
            className="absolute flex w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center focus:outline-none"
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            aria-label={`${s.position} ${p?.name ?? '비어 있음'}`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black shadow ${
              sel ? 'border-gold-300 bg-gold-500 text-navy-950' : !p ? 'border-dashed border-white/40 bg-navy-900/60 text-slate-400'
              : positionGroup(s.position as Player['positions'][0]) === 'GK' ? 'border-gold-400 bg-navy-900 text-gold-300' : 'border-white/70 bg-navy-800 text-white'}`}>
              {p ? playerOvr(p) : s.position}
            </span>
            <span className="mt-0.5 max-w-full truncate rounded bg-navy-950/80 px-1 text-[10px] font-semibold text-white">{p?.name ?? '비어 있음'}</span>
            <span className={`text-[9px] ${fit < 0.8 ? 'text-rose-300' : 'text-emerald-200/80'}`}>{s.position}{p && fit < 0.8 ? ' ⚠' : ''}{extra ? ` ${extra}` : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
