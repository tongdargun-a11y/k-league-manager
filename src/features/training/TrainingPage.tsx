import { Link } from 'react-router-dom';
import { useGame, useWorld } from '../../store/gameStore';
import { FOCUS_LABEL, INTENSITY_LABEL, growthRate, planFor } from '../../engine/training/training';
import { ATTRIBUTE_GROUPS, playerOvr } from '../../engine/ratings/ovr';
import { Bar, OvrBadge, Panel, Segmented } from '../../components/ui';
import { ageOn, formatShort } from '../../utils/date';
import type { TrainingFocus, TrainingIntensity } from '../../types';

const attrLabel = Object.fromEntries(ATTRIBUTE_GROUPS.flatMap((g) => g.attrs.map((a) => [a.key, a.label])));

export function TrainingPage() {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const plan = planFor(world, world.userClubId);
  const squad = Object.values(world.players).filter((p) => p.clubId === world.userClubId).sort((a, b) => playerOvr(b) - playerOvr(a));
  const setPlan = (patch: Partial<typeof plan>) => mutate((w) => ({ ...w, training: { ...w.training, [w.userClubId]: { ...planFor(w, w.userClubId), ...patch } } }));
  const setFocus = (id: string, f: TrainingFocus | null) => mutate((w) => ({ ...w, players: { ...w.players, [id]: { ...w.players[id], trainingFocus: f } } }));
  const report = world.trainingReports[0];
  const today = world.clock.gameDate;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">훈련</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="팀 훈련">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-300">집중 분야</span>
              <Segmented size="sm" value={plan.focus} onChange={(v) => setPlan({ focus: v })} options={(Object.keys(FOCUS_LABEL) as TrainingFocus[]).map((f) => ({ value: f, label: FOCUS_LABEL[f] }))} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-300">강도</span>
              <Segmented size="sm" value={plan.intensity} onChange={(v) => setPlan({ intensity: v })} options={(Object.keys(INTENSITY_LABEL) as TrainingIntensity[]).map((i) => ({ value: i, label: INTENSITY_LABEL[i] }))} />
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-400">
            <li>성장은 매주 월요일에 처리됩니다. 나이가 어리고 잠재력(POT)과 현재 OVR 차이가 클수록, 최근 출전 시간이 많을수록 잘 성장합니다.</li>
            <li>강도가 높으면 성장이 빠르지만 체력 회복이 느리고 훈련 중 부상 위험이 커집니다.</li>
            <li>휴식은 성장 대신 체력·사기 회복을 돕고 경기 감각은 떨어집니다. 31세 이상은 피지컬이 서서히 떨어집니다.</li>
          </ul>
        </Panel>
        <Panel title={report ? `지난 주간 보고 (${formatShort(report.date)})` : '주간 보고'}>
          {!report || report.entries.length === 0 ? <p className="text-sm text-slate-400">아직 보고가 없습니다. 날짜를 진행하면 월요일마다 생성됩니다.</p> : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
              {report.entries.slice(0, 20).map((e) => (
                <li key={e.playerId} className="flex flex-wrap items-center gap-2">
                  <Link to={`/game/player/${e.playerId}`} className="w-24 truncate hover:text-gold-400">{world.players[e.playerId]?.name}</Link>
                  <span className={`w-16 text-xs font-bold ${e.ovrAfter > e.ovrBefore ? 'text-emerald-300' : e.ovrAfter < e.ovrBefore ? 'text-rose-300' : 'text-slate-400'}`}>{e.ovrBefore}→{e.ovrAfter}</span>
                  <span className="flex-1 text-xs text-slate-400">{e.changed.map((c) => `${attrLabel[c.key]} ${c.delta > 0 ? '+' : ''}${c.delta}`).join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="선수별 훈련" className="overflow-x-auto p-0">
        <table className="table-base min-w-[640px]">
          <thead><tr><th>이름</th><th>나이</th><th>OVR / POT</th><th className="w-28">성장 여지</th><th className="w-24">체력</th><th>개인 훈련</th></tr></thead>
          <tbody>
            {squad.map((p) => {
              const g = growthRate(p, today, plan.intensity, 270);
              return (
                <tr key={p.id}>
                  <td><Link to={`/game/player/${p.id}`} className="text-white hover:text-gold-400">{p.name}</Link> <span className="text-[11px] text-slate-500">{p.positions[0]}</span>{p.status.injuryId && <span className="ml-1 text-[11px] text-rose-300">부상</span>}</td>
                  <td className="tabular-nums">{ageOn(p.birthDate, today)}</td>
                  <td className="flex items-center gap-1.5"><OvrBadge value={playerOvr(p)} size="sm" /><span className="text-xs text-slate-400">/ {p.potential}</span></td>
                  <td><Bar value={g * 100} max={100} tone="bg-sky-400" /></td>
                  <td><Bar value={p.status.fitness} /></td>
                  <td>
                    <select className="input w-32 py-1 text-xs" value={p.trainingFocus ?? ''} onChange={(e) => setFocus(p.id, (e.target.value || null) as TrainingFocus | null)} aria-label={`${p.name} 개인 훈련`}>
                      <option value="">팀 훈련 ({FOCUS_LABEL[plan.focus]})</option>
                      {(Object.keys(FOCUS_LABEL) as TrainingFocus[]).map((f) => <option key={f} value={f}>{FOCUS_LABEL[f]}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
