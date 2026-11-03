import type { Formation, Lineup, Player, Position } from '../../types';
import { FORMATIONS } from '../tactics/formations';
import { effectiveRating } from '../ratings/ovr';

export function isAvailable(p: Player): boolean {
  return !p.status.injuryId && p.status.suspendedMatches <= 0;
}

/** 선발 고려 점수: 포지션 실질 능력 × 체력 보정 */
export function selectionScore(p: Player, slot: Position): number {
  return effectiveRating(p, slot) * (0.8 + 0.2 * (p.status.fitness / 100));
}

/**
 * 주어진 선수들을 포메이션 슬롯에 배치 (남는 슬롯은 null).
 * 모든 (슬롯, 선수) 조합을 점수순으로 정렬해 높은 조합부터 확정하는 전역 탐욕 방식.
 */
export function assignToFormation(playerIds: string[], formation: Formation, players: Record<string, Player>): (string | null)[] {
  const slots = FORMATIONS[formation];
  const result: (string | null)[] = slots.map(() => null);
  const ids = [...new Set(playerIds.filter((id) => players[id]))];
  const pairs: { i: number; id: string; score: number }[] = [];
  slots.forEach((s, i) => {
    for (const id of ids) pairs.push({ i, id, score: selectionScore(players[id], s.position) });
  });
  pairs.sort((a, b) => b.score - a.score || a.i - b.i || (a.id < b.id ? -1 : 1));
  const used = new Set<string>();
  for (const { i, id } of pairs) {
    if (result[i] || used.has(id)) continue;
    result[i] = id;
    used.add(id);
  }
  return result;
}

/** AI·자동 선발: 출전 가능한 선수 중 최적 11명 + 벤치 */
export function pickBestLineup(clubId: string, players: Record<string, Player>, formation: Formation, benchSize: number): Lineup {
  const squad = Object.values(players).filter((p) => p.clubId === clubId && isAvailable(p));
  const starters = assignToFormation(squad.map((p) => p.id), formation, players).filter((x): x is string => !!x);
  const rest = squad.filter((p) => !starters.includes(p.id));
  const bench: string[] = [];
  const gk = rest.filter((p) => p.positions[0] === 'GK').sort((a, b) => selectionScore(b, 'GK') - selectionScore(a, 'GK'))[0];
  if (gk) bench.push(gk.id);
  const outfield = rest
    .filter((p) => p.id !== gk?.id)
    .sort((a, b) => selectionScore(b, b.positions[0]) - selectionScore(a, a.positions[0]));
  for (const p of outfield) {
    if (bench.length >= benchSize) break;
    bench.push(p.id);
  }
  const captain = starters
    .map((id) => players[id])
    .sort((a, b) => b.attributes.leadership - a.attributes.leadership)[0];
  return { formation, starters, bench, captainId: captain?.id ?? null };
}

export interface LineupIssue {
  level: 'error' | 'warning';
  message: string;
}

/** 사용자 라인업 검증: 경기 시작 가능 여부와 경고 */
export function validateLineup(lineup: Lineup, players: Record<string, Player>, benchSize: number): LineupIssue[] {
  const issues: LineupIssue[] = [];
  const slots = FORMATIONS[lineup.formation];
  const starters = lineup.starters.filter((id) => players[id]);
  if (starters.length !== 11) issues.push({ level: 'error', message: `선발은 11명이어야 합니다 (현재 ${starters.length}명).` });
  const all = [...lineup.starters, ...lineup.bench];
  if (new Set(all).size !== all.length) issues.push({ level: 'error', message: '같은 선수가 중복 배치되었습니다.' });
  if (lineup.bench.length > benchSize) issues.push({ level: 'error', message: `벤치는 최대 ${benchSize}명입니다.` });
  lineup.starters.forEach((id, i) => {
    const p = players[id];
    if (!p) return;
    if (p.status.injuryId) issues.push({ level: 'error', message: `${p.name} 선수는 부상 중입니다.` });
    if (p.status.suspendedMatches > 0) issues.push({ level: 'error', message: `${p.name} 선수는 출전 정지입니다.` });
    const slot = slots[i];
    if (slot && slot.position === 'GK' && p.positions[0] !== 'GK') issues.push({ level: 'warning', message: `골키퍼 자리에 필드 플레이어(${p.name})가 있습니다.` });
    if (p.status.fitness < 60) issues.push({ level: 'warning', message: `${p.name} 선수의 체력이 낮습니다 (${Math.round(p.status.fitness)}).` });
  });
  for (const id of lineup.bench) {
    const p = players[id];
    if (p && (p.status.injuryId || p.status.suspendedMatches > 0)) issues.push({ level: 'error', message: `벤치의 ${p.name} 선수는 출전할 수 없습니다.` });
  }
  if (!lineup.bench.some((id) => players[id]?.positions[0] === 'GK')) issues.push({ level: 'warning', message: '벤치에 골키퍼가 없습니다.' });
  return issues;
}

/**
 * 사용자 라인업을 현재 선수 상태에 맞게 정리한다.
 * 출전 불가 선수가 선발에 있으면 자동으로 대체하지 않고 그대로 두어 검증 단계에서 알려준다.
 * 다만 다른 구단 소속이거나 존재하지 않는 선수 id는 제거한다.
 */
export function sanitizeLineup(lineup: Lineup, clubId: string, players: Record<string, Player>): Lineup {
  const valid = (id: string) => players[id]?.clubId === clubId;
  return {
    ...lineup,
    starters: lineup.starters.filter(valid),
    bench: lineup.bench.filter(valid),
    captainId: lineup.captainId && valid(lineup.captainId) ? lineup.captainId : null,
  };
}
