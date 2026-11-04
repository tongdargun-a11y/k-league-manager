import { describe, expect, it } from 'vitest';
import { advanceDay, checkSeasonEnd, createNewWorld, simulateDueAIFixtures } from './world';
import { agePlayer, retireChance, startNextSeason } from './season/rollover';
import { playerOvr } from './ratings/ovr';
import { createRng } from '../utils/rng';
import { RETIRED, type WorldState } from '../types';

function finishSeason(): WorldState {
  let w = createNewWorld({ managerName: 't', clubId: TEST_ID, seed: 7 });
  const last = w.fixtures.reduce((m, f) => (f.date > m ? f.date : m), '');
  w = simulateDueAIFixtures({ ...w, userClubId: '__none__' }, last);
  return checkSeasonEnd({ ...w, userClubId: TEST_ID });
}
const TEST_ID = 'stormhaven';

describe('시즌 넘기기', () => {
  const ended = finishSeason();
  it('모든 경기가 끝나면 시즌 종료', () => {
    expect(ended.season.status).toBe('finished');
  });
  const next = startNextSeason(ended);
  it('새 시즌 일정·기록', () => {
    expect(next.season.id).toBe('spd-2027');
    expect(next.season.status).toBe('active');
    expect(next.fixtures.every((f) => f.status === 'scheduled' && f.date >= '2027-02-16')).toBe(true);
    expect(next.history).toHaveLength(1);
    expect(next.history[0].table).toHaveLength(12);
    expect(next.history[0].topScorer?.value).toBeGreaterThan(0);
  });
  it('유소년 입단 및 AI 구단 최소 인원', () => {
    for (const id of next.season.clubIds) {
      const n = Object.values(next.players).filter((p) => p.clubId === id).length;
      expect(n).toBeGreaterThanOrEqual(id === next.userClubId ? 18 : 22);
    }
    expect(Object.values(next.players).some((p) => p.id.includes('-y2027-'))).toBe(true);
  });
  it('결정적(같은 입력 → 같은 결과)', () => {
    expect(JSON.stringify(startNextSeason(ended).players)).toBe(JSON.stringify(next.players));
  });
  it('은퇴 선수는 계약 만료·훈련 대상에서 제외', () => {
    const retired = Object.values(next.players).filter((p) => p.clubId === RETIRED);
    let w = next;
    for (let i = 0; i < 10; i++) { const r = advanceDay(w); if (!r.advanced) break; w = r.world; }
    for (const p of retired) expect(w.players[p.id].clubId).toBe(RETIRED);
  });
  it('끝나지 않은 시즌은 넘길 수 없음', () => {
    expect(() => startNextSeason(next)).toThrow();
  });
});

describe('노화·은퇴', () => {
  const base = createNewWorld({ managerName: 'a', clubId: TEST_ID, seed: 1 });
  const p = Object.values(base.players)[0];
  it('31세 이상은 능력치 하락, 젊은 선수는 그대로', () => {
    const old = { ...p, birthDate: '1990-01-01' };
    expect(playerOvr(agePlayer(old, createRng(1), '2026-12-31'))).toBeLessThan(playerOvr(old));
    const young = { ...p, birthDate: '2004-01-01' };
    expect(agePlayer(young, createRng(1), '2026-12-31')).toBe(young);
  });
  it('은퇴 확률은 나이에 따라 증가', () => {
    expect(retireChance({ ...p, birthDate: '2000-01-01' }, '2026-12-31')).toBe(0);
    expect(retireChance({ ...p, birthDate: '1988-01-01' }, '2026-12-31')).toBeGreaterThan(retireChance({ ...p, birthDate: '1992-06-01' }, '2026-12-31'));
  });
});
