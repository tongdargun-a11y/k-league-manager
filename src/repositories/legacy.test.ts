import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { createNewWorld, advanceDay, WORLD_SCHEMA_VERSION } from '../engine/world';
import { migrateSave } from './migrations';
import { saveRepository, LegacySaveProtectedError } from './saveRepository';
import { useGame } from '../store/gameStore';
import type { SaveGame, WorldState } from '../types';

/**
 * 0-A3: 구버전(v1~v4) 세이브 보호.
 * 샘플은 현재 월드에서 각 버전에 없던 필드를 빼서 합성한 것이다 (실제 사용자 세이브 아님).
 */
function sample(version: 1 | 2 | 3 | 4, id = `legacy-v${version}`): SaveGame {
  const w = createNewWorld({ managerName: '구감독', clubId: 'stormhaven', seed: 3 });
  let world: Partial<WorldState> = w;
  if (version <= 2) { const { history: _h, ...rest } = world; void _h; world = rest; }
  if (version === 1) { const { finance: _f, transfers: _t, incomingOffers: _o, training: _tr, trainingReports: _r, ...rest } = world; void _f; void _t; void _o; void _tr; void _r; world = rest; }
  return { id, schemaVersion: version, name: `구버전 v${version}`, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', gameDate: w.clock.gameDate, managerName: '구감독', selectedClubId: 'stormhaven', world: world as WorldState };
}

async function putRaw(save: SaveGame) {
  const db = new Dexie('k-league-manager');
  db.version(3).stores({ saves: 'id, updatedAt', summaries: 'id, updatedAt', datasets: 'id, importedAt', images: 'key' });
  const { world: _w, ...sum } = save; void _w;
  await db.table('saves').put(save);
  await db.table('summaries').put(sum); // 구버전 요약에는 club 정보가 없다
  const raw = await db.table('saves').get(save.id);
  db.close();
  return raw as SaveGame;
}
async function getRaw(id: string) {
  const db = new Dexie('k-league-manager');
  db.version(3).stores({ saves: 'id, updatedAt', summaries: 'id, updatedAt', datasets: 'id, importedAt', images: 'key' });
  const r = { save: await db.table('saves').get(id), sum: await db.table('summaries').get(id), all: await db.table('saves').count() };
  db.close();
  return r;
}

beforeEach(async () => {
  for (const s of await saveRepository.list()) {
    if (!s.legacy) await saveRepository.remove(s.id);
  }
});

describe('구버전 세이브 불러오기 (v1~v4)', () => {
  it.each([1, 2, 3, 4] as const)('v%i 세이브: 오류 없이 변환되고 입력 객체는 바뀌지 않는다', (v) => {
    const raw = sample(v);
    const before = JSON.stringify(raw);
    const m = migrateSave(raw);
    expect(m.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(m.world.history).toBeDefined();
    expect(m.world.finance).toBeDefined();
    expect(JSON.stringify(raw)).toBe(before);
    // 변환된 월드로 하루 진행이 가능해야 한다
    expect(() => advanceDay(m.world)).not.toThrow();
  });
});

describe('구버전 원본 보존 (DB)', () => {
  it.each([1, 2, 3, 4] as const)('v%i: 불러오기 → 진행 → 자동 저장 후에도 원본 행이 그대로다', async (v) => {
    const original = await putRaw(sample(v, `orig-v${v}`));
    const snapshot = JSON.stringify(original);
    const countBefore = (await getRaw(original.id)).all;

    expect(await useGame.getState().loadGame(original.id)).toBe(true);
    expect(useGame.getState().saveId).toBeNull();
    expect(useGame.getState().legacySourceId).toBe(original.id);
    useGame.getState().mutate((w) => advanceDay(w).world);
    await useGame.getState().saveGame({ silent: true }); // 자동 저장과 같은 경로
    await useGame.getState().saveGame({ silent: true }); // 두 번째 저장도 복사본으로

    const after = await getRaw(original.id);
    expect(JSON.stringify(after.save)).toBe(snapshot);
    expect(after.save.schemaVersion).toBe(v);
    expect(after.all).toBe(countBefore + 1); // 복사본 1개만 추가
    const copyId = useGame.getState().saveId!;
    expect(copyId).not.toBe(original.id);
    const copy = (await getRaw(copyId)).save as SaveGame;
    expect(copy.schemaVersion).toBe(WORLD_SCHEMA_VERSION);
    expect(copy.name).toBe(`구버전 v${v} (이어하기)`);
  });

  it('원본 id로 직접 저장하거나 삭제하려 하면 거부된다', async () => {
    const original = await putRaw(sample(4, 'guard-v4'));
    const world = migrateSave(original).world;
    await expect(saveRepository.write({ id: original.id, name: 'x', world })).rejects.toBeInstanceOf(LegacySaveProtectedError);
    await expect(saveRepository.remove(original.id)).rejects.toBeInstanceOf(LegacySaveProtectedError);
    await useGame.getState().deleteSave(original.id); // 화면 경로: 오류 안내만 하고 지우지 않음
    expect((await getRaw(original.id)).save).toBeTruthy();
  });

  it('목록: 구버전으로 표시되고 구단 이름은 세이브 안의 데이터에서 읽는다', async () => {
    await putRaw(sample(2, 'list-v2'));
    const item = (await saveRepository.list()).find((s) => s.id === 'list-v2')!;
    expect(item.legacy).toBe(true);
    expect(item.club?.name).toBeTruthy();
    expect(item.club?.id).toBe('stormhaven');
  });

  it('새 게임 세이브는 구버전이 아니며 정상적으로 덮어쓰기·삭제된다', async () => {
    await useGame.getState().newGame('새감독', 'lumina');
    const id = useGame.getState().saveId!;
    const item = (await saveRepository.list()).find((s) => s.id === id)!;
    expect(item.legacy).toBe(false);
    expect(item.club?.id).toBe('lumina');
    await useGame.getState().saveGame({ silent: true });
    expect(useGame.getState().saveId).toBe(id);
    await saveRepository.remove(id);
    expect((await getRaw(id)).save).toBeUndefined();
  });
});
