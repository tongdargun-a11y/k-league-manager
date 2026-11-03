import type { AttributeKey, Player, PlayerAttributes, Position, PositionGroup } from '../../types';

/** 포지션별 능력치 가중치. 합이 1이 될 필요는 없다(정규화함). */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  GK: { reflexes: 5, handling: 4, gkPositioning: 4, decisions: 2, composure: 2, jumping: 1, longPassing: 1 },
  CB: { tackling: 4, marking: 4, defPositioning: 4, interceptions: 3, heading: 3, strength: 3, jumping: 2, decisions: 2, composure: 1, pace: 1, shortPassing: 1 },
  LB: { tackling: 3, marking: 3, defPositioning: 2, pace: 3, acceleration: 2, stamina: 3, crossing: 3, shortPassing: 2, interceptions: 2, teamwork: 1 },
  RB: { tackling: 3, marking: 3, defPositioning: 2, pace: 3, acceleration: 2, stamina: 3, crossing: 3, shortPassing: 2, interceptions: 2, teamwork: 1 },
  DM: { tackling: 3, interceptions: 4, defPositioning: 3, shortPassing: 3, longPassing: 2, stamina: 2, strength: 2, decisions: 3, teamwork: 2, marking: 1 },
  CM: { shortPassing: 4, longPassing: 3, vision: 3, decisions: 3, stamina: 3, teamwork: 2, tackling: 2, interceptions: 1, composure: 2, shooting: 1 },
  AM: { vision: 4, shortPassing: 4, offPositioning: 3, shooting: 3, finishing: 2, composure: 2, decisions: 3, acceleration: 2 },
  LM: { crossing: 4, pace: 3, acceleration: 3, stamina: 3, shortPassing: 3, vision: 2, teamwork: 2, offPositioning: 1 },
  RM: { crossing: 4, pace: 3, acceleration: 3, stamina: 3, shortPassing: 3, vision: 2, teamwork: 2, offPositioning: 1 },
  LW: { pace: 4, acceleration: 4, crossing: 3, finishing: 3, shooting: 2, offPositioning: 2, shortPassing: 2, composure: 1 },
  RW: { pace: 4, acceleration: 4, crossing: 3, finishing: 3, shooting: 2, offPositioning: 2, shortPassing: 2, composure: 1 },
  ST: { finishing: 5, offPositioning: 4, shooting: 3, heading: 3, composure: 3, pace: 2, acceleration: 2, strength: 2 },
};

export function positionGroup(pos: Position): PositionGroup {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DF';
  if (pos === 'ST' || pos === 'LW' || pos === 'RW') return 'FW';
  return 'MF';
}

export const POSITION_LABEL: Record<Position, string> = {
  GK: '골키퍼', CB: '센터백', LB: '왼쪽 풀백', RB: '오른쪽 풀백', DM: '수비형 미드필더',
  CM: '중앙 미드필더', AM: '공격형 미드필더', LM: '왼쪽 미드필더', RM: '오른쪽 미드필더',
  LW: '왼쪽 윙어', RW: '오른쪽 윙어', ST: '스트라이커',
};

/** 능력치 → 특정 포지션 OVR (1~99 정수) */
export function ovrForPosition(attrs: PlayerAttributes, pos: Position): number {
  const weights = POSITION_WEIGHTS[pos];
  let sum = 0;
  let total = 0;
  for (const [key, w] of Object.entries(weights) as [AttributeKey, number][]) {
    sum += (attrs[key] ?? 50) * w;
    total += w;
  }
  const raw = total > 0 ? sum / total : 50;
  return clamp(Math.round(raw), 1, 99);
}

/** 선수의 주 포지션 OVR */
export function playerOvr(player: Player): number {
  return ovrForPosition(player.attributes, player.positions[0] ?? 'CM');
}

/** 인접 포지션 (익숙하진 않아도 어느 정도 소화 가능) */
const ADJACENT: Record<Position, Position[]> = {
  GK: [],
  CB: ['DM', 'LB', 'RB'],
  LB: ['CB', 'LM', 'RB'],
  RB: ['CB', 'RM', 'LB'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM', 'LM', 'RM'],
  AM: ['CM', 'ST', 'LW', 'RW'],
  LM: ['LW', 'LB', 'CM', 'RM'],
  RM: ['RW', 'RB', 'CM', 'LM'],
  LW: ['LM', 'RW', 'ST', 'AM'],
  RW: ['RM', 'LW', 'ST', 'AM'],
  ST: ['AM', 'LW', 'RW'],
};

/**
 * 포지션 적합도 (0~1). 주 포지션 1.0, 보조 0.95, 인접 0.82, 같은 그룹 0.72, 그 외 0.5.
 * 골키퍼 슬롯에 필드 플레이어(또는 반대)는 매우 낮다.
 */
export function positionFit(player: Player, slot: Position): number {
  const [primary, ...secondary] = player.positions;
  if (primary === slot) return 1;
  if (secondary.includes(slot)) return 0.95;
  if (slot === 'GK' || primary === 'GK') return 0.25;
  if (ADJACENT[primary]?.includes(slot) || secondary.some((s) => ADJACENT[s]?.includes(slot))) return 0.82;
  if (positionGroup(primary) === positionGroup(slot)) return 0.72;
  return 0.5;
}

/** 해당 슬롯에서의 실질 능력 (능력치 기반 OVR × 익숙함 보정) */
export function effectiveRating(player: Player, slot: Position): number {
  const base = ovrForPosition(player.attributes, slot);
  const fit = positionFit(player, slot);
  // 포지션 OVR 자체가 능력치를 반영하므로 익숙함 보정은 완만하게
  const familiarity = 0.75 + 0.25 * fit;
  return base * familiarity;
}

export function fitLabel(fit: number): { label: string; tone: 'good' | 'ok' | 'bad' } {
  if (fit >= 0.95) return { label: '최적', tone: 'good' };
  if (fit >= 0.8) return { label: '양호', tone: 'ok' };
  return { label: '부적합', tone: 'bad' };
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 능력치 그룹 평균 (화면 표시용) */
export const ATTRIBUTE_GROUPS: { key: string; label: string; attrs: { key: AttributeKey; label: string }[] }[] = [
  { key: 'attack', label: '공격', attrs: [
    { key: 'finishing', label: '결정력' }, { key: 'shooting', label: '슈팅' },
    { key: 'offPositioning', label: '위치 선정' }, { key: 'heading', label: '헤딩' } ] },
  { key: 'passing', label: '패스', attrs: [
    { key: 'shortPassing', label: '짧은 패스' }, { key: 'longPassing', label: '긴 패스' },
    { key: 'vision', label: '시야' }, { key: 'crossing', label: '크로스' } ] },
  { key: 'defense', label: '수비', attrs: [
    { key: 'tackling', label: '태클' }, { key: 'marking', label: '대인 방어' },
    { key: 'defPositioning', label: '위치 선정' }, { key: 'interceptions', label: '인터셉트' } ] },
  { key: 'physical', label: '피지컬', attrs: [
    { key: 'pace', label: '속도' }, { key: 'acceleration', label: '가속' }, { key: 'stamina', label: '체력' },
    { key: 'strength', label: '몸싸움' }, { key: 'jumping', label: '점프' } ] },
  { key: 'mental', label: '정신', attrs: [
    { key: 'decisions', label: '판단력' }, { key: 'composure', label: '침착성' }, { key: 'leadership', label: '리더십' },
    { key: 'aggression', label: '적극성' }, { key: 'teamwork', label: '팀워크' } ] },
  { key: 'goalkeeping', label: '골키핑', attrs: [
    { key: 'reflexes', label: '반응속도' }, { key: 'handling', label: '핸들링' }, { key: 'gkPositioning', label: '위치 선정' } ] },
];

export function groupAverage(attrs: PlayerAttributes, groupKey: string): number {
  const g = ATTRIBUTE_GROUPS.find((x) => x.key === groupKey);
  if (!g) return 0;
  return Math.round(g.attrs.reduce((s, a) => s + attrs[a.key], 0) / g.attrs.length);
}
