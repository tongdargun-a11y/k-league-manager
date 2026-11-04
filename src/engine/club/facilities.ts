import type { ClubModeState, FacilityKind, WorldState } from '../../types';
import { recordTx } from '../finance/finance';

/** 구단운영 모드: 시설·팬 (PHASE 2). 내 구단에만 적용한다. */
export const FACILITY_INFO: Record<FacilityKind, { label: string; effect: string }> = {
  stadium: { label: '경기장', effect: '홈경기 관중 수 증가' },
  training: { label: '훈련장', effect: '선수 성장 속도 증가' },
  youth: { label: '유소년 아카데미', effect: '시즌 후 입단하는 유소년 능력·잠재력 증가' },
};
export const MAX_FACILITY = 5;

export const defaultClubState = (): ClubModeState => ({ kind: 'club', facilities: { stadium: 2, training: 2, youth: 2 }, fanSatisfaction: 60 });

/** 구단운영 모드면 상태(없으면 기본값), 아니면 null */
export function clubState(w: Pick<WorldState, 'mode' | 'modeState'>): ClubModeState | null {
  if (w.mode !== 'club') return null;
  return w.modeState?.kind === 'club' ? w.modeState : defaultClubState();
}

/** 다음 레벨로 올리는 비용 (만원) */
export const upgradeCost = (level: number) => 15000 * level;

export function upgradeFacility(w: WorldState, kind: FacilityKind): { world: WorldState; ok: boolean; reason?: string } {
  const st = clubState(w);
  if (!st) return { world: w, ok: false, reason: '구단운영 모드에서만 가능합니다.' };
  const lv = st.facilities[kind];
  if (lv >= MAX_FACILITY) return { world: w, ok: false, reason: '이미 최고 레벨입니다.' };
  const cost = upgradeCost(lv);
  const club = w.clubs[w.userClubId];
  if (club.finances.balance < cost) return { world: w, ok: false, reason: '잔고가 부족합니다.' };
  let next: WorldState = { ...w, modeState: { ...st, facilities: { ...st.facilities, [kind]: lv + 1 } } };
  next = recordTx(next, { date: w.clock.gameDate, clubId: w.userClubId, category: 'facility', amount: -cost, note: `${FACILITY_INFO[kind].label} ${lv + 1}레벨 공사` });
  return { world: next, ok: true };
}

/** 관중 배수: 경기장 레벨 × 팬 만족도 (레벨2·만족도60 ≈ 1.0) */
export function attendanceMult(st: ClubModeState): number {
  return (0.85 + 0.075 * st.facilities.stadium) * (0.76 + 0.004 * st.fanSatisfaction);
}
/** 훈련 성장 배수 (레벨2 = 1.0) */
export const trainingMult = (st: ClubModeState) => 0.85 + 0.075 * st.facilities.training;
/** 유소년 능력 보너스 (레벨2 = 0) */
export const youthBonus = (st: ClubModeState) => (st.facilities.youth - 2) * 3;

/** 경기 결과에 따른 팬 만족도 변화 */
export function applyFanResult(w: WorldState, goalsFor: number, goalsAgainst: number): WorldState {
  const st = clubState(w);
  if (!st) return w;
  const delta = goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 0 : -3;
  const fan = Math.max(0, Math.min(100, st.fanSatisfaction + delta));
  return { ...w, modeState: { ...st, fanSatisfaction: fan } };
}
