import { clubState, trainingMult } from '../club/facilities';
/**
 * 훈련·성장 (주 단위). 성장 요인: 나이, 잠재력과 현재 OVR 차이, 훈련 강도, 최근 출전 시간.
 * 30세 이후에는 피지컬 능력치가 천천히 감소한다. 난수는 날짜·선수 id로 시드를 고정해 재현 가능.
 */
import type { AttributeKey, GameDate, Player, TrainingFocus, TrainingIntensity, TrainingPlan, TrainingReport, TrainingReportEntry, WorldState } from '../../types';
import { FREE_AGENT, RETIRED } from '../../types';
import { ATTRIBUTE_GROUPS, POSITION_WEIGHTS, clamp, playerOvr } from '../ratings/ovr';
import { ageOn } from '../../utils/date';
import { createRng, hashString } from '../../utils/rng';

export const DEFAULT_TRAINING: TrainingPlan = { focus: 'balanced', intensity: 'normal' };

export const FOCUS_LABEL: Record<TrainingFocus, string> = {
  balanced: '균형', attack: '공격', defense: '수비', passing: '패스', physical: '피지컬', rest: '휴식',
};
export const INTENSITY_LABEL: Record<TrainingIntensity, string> = { low: '낮음', normal: '보통', high: '높음' };

const FOCUS_GROUP: Record<Exclude<TrainingFocus, 'balanced' | 'rest'>, string> = {
  attack: 'attack', defense: 'defense', passing: 'passing', physical: 'physical',
};

const INTENSITY_GROWTH: Record<TrainingIntensity, number> = { low: 0.7, normal: 1, high: 1.3 };
/** 하루 훈련 부상 확률 (선수 1명 기준) */
export const INTENSITY_INJURY: Record<TrainingIntensity, number> = { low: 0.00008, normal: 0.0002, high: 0.0006 };
/** 하루 체력 회복 보정 */
export const INTENSITY_RECOVERY: Record<TrainingIntensity, number> = { low: 1.5, normal: 0, high: -2 };

export function planFor(world: WorldState, clubId: string): TrainingPlan {
  return world.training[clubId] ?? DEFAULT_TRAINING;
}

function groupKeys(groupKey: string): AttributeKey[] {
  return ATTRIBUTE_GROUPS.find((g) => g.key === groupKey)?.attrs.map((a) => a.key) ?? [];
}

const PHYSICAL: AttributeKey[] = ['pace', 'acceleration', 'stamina', 'strength', 'jumping'];

/** 성장 계수 (주당). 0이면 성장하지 않는다. */
export function growthRate(p: Player, today: GameDate, intensity: TrainingIntensity, recentMinutes: number): number {
  const age = ageOn(p.birthDate, today);
  const gap = clamp((p.potential - playerOvr(p)) / 15, 0, 1.2);
  const ageF = age <= 20 ? 1 : age <= 23 ? 0.8 : age <= 26 ? 0.5 : age <= 29 ? 0.25 : age <= 31 ? 0.1 : 0;
  const minutesF = 0.8 + 0.4 * Math.min(1, recentMinutes / 270);
  return gap * ageF * INTENSITY_GROWTH[intensity] * minutesF;
}

/**
 * 한 선수의 주간 훈련 결과. 순수 함수.
 * @param recentMinutes 최근 약 3경기 출전 시간
 */
export function trainPlayer(p: Player, plan: TrainingPlan, today: GameDate, recentMinutes: number, mult = 1): { player: Player; entry: TrainingReportEntry | null } {
  const focus = p.trainingFocus ?? plan.focus;
  if (focus === 'rest') return { player: p, entry: null };
  const rng = createRng(hashString(`train:${today}:${p.id}`));
  const age = ageOn(p.birthDate, today);
  const base = growthRate(p, today, plan.intensity, recentMinutes) * mult;
  const posKeys = Object.keys(POSITION_WEIGHTS[p.positions[0]]) as AttributeKey[];
  const focusKeys = focus === 'balanced' ? [] : groupKeys(FOCUS_GROUP[focus]);
  const attrs = { ...p.attributes };
  const changed: { key: AttributeKey; delta: number }[] = [];
  for (const key of Object.keys(attrs) as AttributeKey[]) {
    let pUp = base * 0.035;
    if (posKeys.includes(key)) pUp += base * 0.12;
    if (focusKeys.includes(key)) pUp += base * 0.16;
    if (focus === 'balanced' && posKeys.includes(key)) pUp += base * 0.04;
    let delta = 0;
    if (attrs[key] < 97 && rng.chance(pUp)) delta += 1;
    if (age >= 31 && PHYSICAL.includes(key) && rng.chance((age - 30) * 0.025)) delta -= 1;
    if (delta !== 0) {
      attrs[key] = clamp(attrs[key] + delta, 10, 97);
      changed.push({ key, delta });
    }
  }
  if (!changed.length) return { player: p, entry: null };
  const before = playerOvr(p);
  const next: Player = { ...p, attributes: attrs };
  const after = playerOvr(next);
  next.peakOvr = Math.max(next.peakOvr, after);
  return { player: next, entry: { playerId: p.id, ovrBefore: before, ovrAfter: after, changed } };
}

/** 최근 3경기 출전 시간 (경기 리포트 기반) */
function recentMinutesMap(world: WorldState): Map<string, number> {
  const played = world.fixtures.filter((f) => f.status === 'played').sort((a, b) => (a.date < b.date ? 1 : -1));
  const perClubCount = new Map<string, number>();
  const minutes = new Map<string, number>();
  for (const f of played) {
    const r = world.reports[f.id];
    if (!r) continue;
    for (const clubId of [f.homeClubId, f.awayClubId]) {
      const c = perClubCount.get(clubId) ?? 0;
      if (c >= 3) continue;
      perClubCount.set(clubId, c + 1);
      for (const ps of r.players) if (ps.clubId === clubId) minutes.set(ps.playerId, (minutes.get(ps.playerId) ?? 0) + ps.minutes);
    }
  }
  return minutes;
}

/** 주간 훈련 처리 (모든 구단). 사용자 구단 결과는 리포트로 남긴다. */
export function processWeeklyTraining(world: WorldState, date: GameDate): WorldState {
  const recent = recentMinutesMap(world);
  const players = { ...world.players };
  const entries: TrainingReportEntry[] = [];
  const cst = clubState(world);
  const userMult = cst ? trainingMult(cst) : 1;
  for (const p of Object.values(world.players)) {
    if (p.clubId === FREE_AGENT || p.clubId === RETIRED || p.status.injuryId) continue;
    const plan = planFor(world, p.clubId);
    const { player, entry } = trainPlayer(p, plan, date, recent.get(p.id) ?? 0, p.clubId === world.userClubId ? userMult : 1);
    players[p.id] = player;
    if (entry && p.clubId === world.userClubId) entries.push(entry);
  }
  const report: TrainingReport = {
    date,
    entries: entries.sort((a, b) => (b.ovrAfter - b.ovrBefore) - (a.ovrAfter - a.ovrBefore)),
  };
  return { ...world, players, trainingReports: [report, ...world.trainingReports].slice(0, 20) };
}
