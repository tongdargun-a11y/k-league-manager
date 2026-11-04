import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createNewWorld, prepareMatch, applyMatchResult, advanceDay } from '../engine/world';
import { simulateToEnd } from '../engine/match/engine';
import { executeTransfer } from '../engine/transfers/transfers';
import { trainPlayer } from '../engine/training/training';
import { saveRepository } from './saveRepository';
import type { WorldState } from '../types';

/**
 * 0-I: 세이브 독립성. 같은 초기 세계관으로 세이브 3개를 만든 뒤 하나씩 실제로 바꿔 저장하고,
 * 나머지 세이브의 DB 내용이 한 글자도 바뀌지 않았는지 비교한다.
 * (모드 필드는 PHASE 1에서 추가되므로 여기서는 각 모드가 하게 될 조작을 엔진 함수로 재현한다.)
 */
const snap = async (id: string) => JSON.stringify((await saveRepository.load(id))!.world);

async function threeSaves() {
  const mk = (name: string) => saveRepository.write({ name, world: createNewWorld({ managerName: name, clubId: 'stormhaven', seed: 7 }) });
  const [club, manager, player] = await Promise.all([mk('구단운영'), mk('감독'), mk('선수')]);
  return { club, manager, player };
}

/** 구단운영: 선수 영입 + 능력치 변경 + 재정 변경 */
function clubOps(w: WorldState): WorldState {
  const target = Object.values(w.players).find((p) => p.clubId === 'lumina')!;
  let n = executeTransfer(w, { playerId: target.id, toClubId: 'stormhaven', fee: 5000, wage: 300, years: 3 });
  const p = n.players[target.id];
  n = { ...n, players: { ...n.players, [p.id]: { ...p, attributes: { ...p.attributes, finishing: 99 } } } };
  return { ...n, clubs: { ...n.clubs, stormhaven: { ...n.clubs.stormhaven, finances: { ...n.clubs.stormhaven.finances, balance: 1 } } } };
}
/** 감독: 다른 선수 영입 + 경기 진행 */
function managerOps(w: WorldState): WorldState {
  const target = Object.values(w.players).find((p) => p.clubId === 'mossvale')!;
  let n = executeTransfer(w, { playerId: target.id, toClubId: 'stormhaven', fee: 1000, wage: 100, years: 2 });
  const f = n.fixtures.find((x) => x.homeClubId === 'stormhaven' || x.awayClubId === 'stormhaven')!;
  n = applyMatchResult(n, simulateToEnd(prepareMatch(n, f), n.players));
  return advanceDay(n).world;
}
/** 선수: 개인 능력치 성장 + 다른 구단 이적 */
function playerOps(w: WorldState): WorldState {
  const me = Object.values(w.players).find((p) => p.clubId === 'stormhaven' && p.positions[0] === 'ST')!;
  let grown = me;
  for (let i = 0; i < 30; i++) grown = trainPlayer(grown, { focus: 'attack', intensity: 'high' }, w.clock.gameDate, 0).player;
  const n = { ...w, players: { ...w.players, [me.id]: { ...grown, potential: 99 } } };
  return executeTransfer(n, { playerId: me.id, toClubId: 'windmere', fee: 0, wage: 200, years: 2 });
}

describe('세이브 독립성 (실제 변경 후 비교)', () => {
  it.each([
    ['구단운영', 'club', clubOps],
    ['감독', 'manager', managerOps],
    ['선수', 'player', playerOps],
  ] as const)('%s 세이브를 바꿔도 다른 두 세이브는 그대로다', async (_label, key, op) => {
    const saves = await threeSaves();
    const before = { club: await snap(saves.club.id), manager: await snap(saves.manager.id), player: await snap(saves.player.id) };
    const target = saves[key];
    const loaded = (await saveRepository.load(target.id))!;
    const changed = op(loaded.world);
    await saveRepository.write({ id: target.id, name: target.name, world: changed, createdAt: target.createdAt });

    expect(await snap(target.id)).not.toBe(before[key]); // 바꾼 세이브는 실제로 바뀜
    for (const other of (['club', 'manager', 'player'] as const).filter((k) => k !== key)) {
      expect(await snap(saves[other].id)).toBe(before[other]);
    }
  });

  it('같은 선수 id가 여러 세이브에 있어도 서로 다른 값을 가질 수 있다', async () => {
    const s = await threeSaves();
    const w = (await saveRepository.load(s.player.id))!.world;
    const changed = playerOps(w);
    await saveRepository.write({ id: s.player.id, name: s.player.name, world: changed, createdAt: s.player.createdAt });
    const movedId = Object.keys(changed.players).find((id) => changed.players[id].clubId === 'windmere' && w.players[id].clubId === 'stormhaven')!;
    const inPlayer = (await saveRepository.load(s.player.id))!.world.players[movedId];
    const inClub = (await saveRepository.load(s.club.id))!.world.players[movedId];
    expect(inPlayer.clubId).toBe('windmere');
    expect(inClub.clubId).toBe('stormhaven');
  });
});

describe('이름 한글 표시', () => {
  it('12개 구단 모든 선수 이름에 한글이 있고 영문 알파벳이 없다', () => {
    const w = createNewWorld({ managerName: '감독', clubId: 'stormhaven', seed: 1 });
    const bad = Object.values(w.players).filter((p) => !/[가-힣]/.test(p.name) || /[A-Za-z]/.test(p.name));
    expect(Object.keys(w.clubs)).toHaveLength(12);
    expect(Object.values(w.players).length).toBeGreaterThanOrEqual(12 * 22);
    expect(bad.map((p) => p.name)).toEqual([]);
  });
});
