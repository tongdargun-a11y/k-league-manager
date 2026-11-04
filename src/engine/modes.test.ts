import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { advanceDay, createNewWorld, fixtureFor } from './world';
import { canOpen, capsOf } from './modes';
import { useGame } from '../store/gameStore';
import { saveRepository } from '../repositories/saveRepository';

describe('플레이 모드 (PHASE 1-1)', () => {
  it('모드 없는 세이브는 기존 방식(모든 기능)', () => {
    const w = createNewWorld({ managerName: 'T', clubId: 'stormhaven', seed: 1 });
    expect(w.mode).toBeUndefined();
    expect(capsOf(w)).toMatchObject({ finance: true, tactics: true, liveMatch: true });
  });

  it('권한 표: 구단운영은 전술·경기 지휘 불가, 감독은 재정 불가', () => {
    const club = { mode: 'club' as const };
    const manager = { mode: 'manager' as const };
    expect(canOpen(club, '/game/tactics')).toBe(false);
    expect(canOpen(club, '/game/match')).toBe(false);
    expect(canOpen(club, '/game/finance')).toBe(true);
    expect(canOpen(manager, '/game/finance')).toBe(false);
    expect(canOpen(manager, '/game/tactics')).toBe(true);
    expect(canOpen(manager, '/game/squad')).toBe(true);
  });

  it('구단운영 모드는 경기일에 멈추지 않고 사용자 경기도 자동 진행한다', () => {
    let w = createNewWorld({ managerName: 'T', clubId: 'stormhaven', seed: 2, mode: 'club' });
    const first = w.fixtures.filter((f) => f.homeClubId === 'stormhaven' || f.awayClubId === 'stormhaven').sort((a, b) => a.date.localeCompare(b.date))[0];
    for (let i = 0; i < 40 && w.clock.gameDate <= first.date; i++) {
      const r = advanceDay(w);
      expect(r.stopReason).not.toBe('match-day');
      w = r.world;
    }
    expect(w.fixtures.find((f) => f.id === first.id)!.status).toBe('played');
    expect(w.inbox.some((m) => m.title.startsWith('경기 결과'))).toBe(true);
  });

  it('감독 모드는 경기일에 멈춘다', () => {
    let w = createNewWorld({ managerName: 'T', clubId: 'stormhaven', seed: 2, mode: 'manager' });
    let stopped = false;
    for (let i = 0; i < 40 && !stopped; i++) {
      const today = fixtureFor(w, w.clock.gameDate, w.userClubId);
      const r = advanceDay(w);
      if (today && today.status !== 'played') { expect(r.advanced).toBe(false); stopped = true; }
      w = r.world;
    }
    expect(stopped).toBe(true);
  });

  it('새 게임: 모드와 worldId가 세이브와 목록에 저장되고, 구단운영 모드는 전술 변경이 막힌다', async () => {
    await useGame.getState().newGame('대표', 'lumina', null, 'club');
    const st = useGame.getState();
    expect(st.world!.mode).toBe('club');
    expect(st.world!.worldId).toMatch(/^world_/);
    const item = (await saveRepository.list()).find((s) => s.id === st.saveId)!;
    expect(item.mode).toBe('club');
    const before = st.world!.tactics.lumina;
    st.setTactic({ ...before, mentality: 'attacking' });
    expect(useGame.getState().world!.tactics.lumina).toEqual(before);
    expect(useGame.getState().startMatch().ok).toBe(false);
  });
});
