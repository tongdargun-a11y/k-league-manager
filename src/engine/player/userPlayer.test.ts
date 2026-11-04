import { describe, expect, it } from 'vitest';
import { advanceDay, createNewWorld } from '../world';
import { userPlayerOf, playerState } from './userPlayer';
import { capsOf } from '../modes';
import { playerOvr } from '../ratings/ovr';

const make = () => createNewWorld({ managerName: '나선수', clubId: 'lumina', mode: 'player', worldId: 'w1', userPlayer: { name: '나선수', position: 'ST' } });

describe('PHASE 3-1 선수 모드', () => {
  it('내 선수가 선택한 구단에 18세 유망주로 생긴다', () => {
    const w = make();
    const me = userPlayerOf(w)!;
    expect(me.name).toBe('나선수');
    expect(me.clubId).toBe('lumina');
    expect(me.positions[0]).toBe('ST');
    expect(me.potential).toBeGreaterThan(playerOvr(me) + 20);
    expect(playerState(w)!.userPlayerId).toBe(me.id);
    const nums = Object.values(w.players).filter((p) => p.clubId === 'lumina').map((p) => p.shirtNumber);
    expect(new Set(nums).size).toBe(nums.length);
  });
  it('다른 모드에는 내 선수가 없다', () => {
    expect(userPlayerOf(createNewWorld({ managerName: '가', clubId: 'lumina', mode: 'manager' }))).toBeNull();
  });
  it('선수 모드는 플레이 가능하고 경기는 자동 진행된다', () => {
    let w = make();
    expect(capsOf(w).playable).toBe(true);
    for (let i = 0; i < 40; i++) {
      const r = advanceDay(w);
      expect(r.stopReason).not.toBe('match-day');
      w = r.world;
    }
    expect(w.fixtures.some((f) => f.status === 'played' && (f.homeClubId === 'lumina' || f.awayClubId === 'lumina'))).toBe(true);
  });
});
