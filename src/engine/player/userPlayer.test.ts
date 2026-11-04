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

describe('PHASE 3-2/3-3 커리어', () => {
  it('주전 경쟁 정보와 경기 후 활약 알림', async () => {
    const { squadRole } = await import('./userPlayer');
    let w = make();
    const me = userPlayerOf(w)!;
    const r = squadRole(w, me.id);
    expect(['starter', 'bench', 'reserve']).toContain(r.role);
    expect(r.rankInGroup).toBeGreaterThan(0);
    for (let i = 0; i < 14; i++) w = advanceDay(w).world;
    expect(w.inbox.some((m) => m.body.startsWith('내 활약:'))).toBe(true);
  });
  it('이적 요청: 관심 구단이 있으면 이적하고 내 구단이 바뀐다', async () => {
    const { requestTransfer } = await import('./career');
    let w = make();
    const me = userPlayerOf(w)!;
    // 능력을 크게 올려 관심 구단을 만든다
    const strong = Object.fromEntries(Object.entries(me.attributes).map(([k]) => [k, 90])) as unknown as typeof me.attributes;
    w = { ...w, clock: { ...w.clock, gameDate: '2026-02-20' }, players: { ...w.players, [me.id]: { ...me, attributes: strong } } };
    const r = requestTransfer(w);
    expect(r.ok, r.message).toBe(true);
    expect(r.world.userClubId).not.toBe('lumina');
    expect(r.world.players[me.id].clubId).toBe(r.world.userClubId);
  });
  it('이적시장 밖·약한 선수는 이적 불가', async () => {
    const { requestTransfer } = await import('./career');
    const w = make();
    expect(requestTransfer({ ...w, clock: { ...w.clock, gameDate: '2026-05-01' } }).ok).toBe(false);
  });
  it('은퇴는 30세 이상에서만, 은퇴하면 소속이 은퇴로 바뀐다', async () => {
    const { canRetire, retireUserPlayer } = await import('./career');
    const w = make();
    expect(canRetire(w)).toBe(false);
    const me = userPlayerOf(w)!;
    const old = { ...w, players: { ...w.players, [me.id]: { ...me, birthDate: '1990-01-01' } } };
    expect(canRetire(old)).toBe(true);
    expect(retireUserPlayer(old).players[me.id].clubId).toBe('retired');
  });
});
