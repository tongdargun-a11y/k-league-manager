import Dexie, { type Table } from 'dexie';
import type { SaveGame, SaveSummary, WorldState } from '../types';
import { WORLD_SCHEMA_VERSION } from '../engine/world';
import { migrateSave } from './migrations';
import { uid } from '../utils/id';

/**
 * IndexedDB 세이브 저장소 (Dexie).
 * - saves: 전체 세이브 (world 포함)
 * - summaries: 목록 화면용 요약 (world 없이 가볍게)
 * 두 테이블은 하나의 트랜잭션으로 함께 기록되어, 저장 중 탭이 닫혀도 반쪽 저장이 남지 않는다.
 */
class SaveDB extends Dexie {
  saves!: Table<SaveGame, string>;
  summaries!: Table<SaveSummary, string>;
  constructor() {
    super('k-league-manager');
    this.version(1).stores({
      saves: 'id, updatedAt',
      summaries: 'id, updatedAt',
    });
  }
}

const db = new SaveDB();

function toSummary(save: SaveGame): SaveSummary {
  const { world: _world, ...rest } = save;
  void _world;
  return rest;
}

export const saveRepository = {
  async list(): Promise<SaveSummary[]> {
    return db.summaries.orderBy('updatedAt').reverse().toArray();
  },

  async load(id: string): Promise<SaveGame | null> {
    const raw = await db.saves.get(id);
    return raw ? migrateSave(raw) : null;
  },

  async write(params: { id?: string; name: string; world: WorldState; createdAt?: string }): Promise<SaveGame> {
    const now = new Date().toISOString();
    const club = params.world.clubs[params.world.userClubId];
    const save: SaveGame = {
      id: params.id ?? uid('save'),
      schemaVersion: WORLD_SCHEMA_VERSION,
      name: params.name || `${params.world.manager.name} · ${club?.shortName ?? ''}`,
      createdAt: params.createdAt ?? now,
      updatedAt: now,
      gameDate: params.world.clock.gameDate,
      managerName: params.world.manager.name,
      selectedClubId: params.world.userClubId,
      world: params.world,
    };
    await db.transaction('rw', db.saves, db.summaries, async () => {
      await db.saves.put(save);
      await db.summaries.put(toSummary(save));
    });
    return save;
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.saves, db.summaries, async () => {
      await db.saves.delete(id);
      await db.summaries.delete(id);
    });
  },
};

// 작은 설정값은 localStorage (실패해도 게임 진행에 영향 없음)
const LAST_SAVE_KEY = 'klm:lastSaveId';
export const prefs = {
  getLastSaveId(): string | null {
    try { return localStorage.getItem(LAST_SAVE_KEY); } catch { return null; }
  },
  setLastSaveId(id: string | null) {
    try {
      if (id) localStorage.setItem(LAST_SAVE_KEY, id);
      else localStorage.removeItem(LAST_SAVE_KEY);
    } catch { /* 무시 */ }
  },
};
