import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { advanceDay, createNewWorld } from './world';
import { startNextSeason } from './season/rollover';
import type { WorldState } from '../types';

/** PHASE 4 밸런스 점검: 구단운영 모드로 두 시즌을 끝까지 돌려 수치가 정상 범위인지 본다. */
describe('밸런스 (두 시즌 시뮬레이션)', () => {
  it('득점·무승부·선수단·재정이 정상 범위', () => {
    let w: WorldState = createNewWorld({ managerName: '시뮬', clubId: 'mossvale', mode: 'club', worldId: 'sim' });
    for (let y = 0; y < 2; y++) {
      let n = 0;
      while (w.season.status !== 'finished' && n++ < 400) w = advanceDay(w).world;
      const played = w.fixtures.filter((f) => f.status === 'played' && f.seasonId === w.season.id);
      expect(played.length).toBe(198);
      const goals = played.reduce((s, f) => s + f.result!.homeGoals + f.result!.awayGoals, 0) / played.length;
      const draws = played.filter((f) => f.result!.homeGoals === f.result!.awayGoals).length / played.length;
      expect(goals).toBeGreaterThan(2.2);
      expect(goals).toBeLessThan(3.4);
      expect(draws).toBeGreaterThan(0.15);
      expect(draws).toBeLessThan(0.35);
      for (const c of Object.keys(w.clubs)) {
        if (c === w.userClubId) continue;
        expect(Object.values(w.players).filter((p) => p.clubId === c).length).toBeGreaterThanOrEqual(w.competition.format.minSquadSize);
        expect(Math.abs(w.clubs[c].finances.balance)).toBeLessThan(2_000_000); // 200억 미만
      }
      w = startNextSeason(w);
    }
  }, 60000);
});
