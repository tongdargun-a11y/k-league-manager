import type { SaveGame } from '../types';
import { WORLD_SCHEMA_VERSION } from '../engine/world';
import { TEST_FORMAT } from '../data';
import { DEFAULT_TRAINING } from '../engine/training/training';

/**
 * 세이브 데이터 마이그레이션.
 * 스키마가 바뀔 때마다 MIGRATIONS[이전버전] 함수를 추가한다.
 * 예) 1 → 2: MIGRATIONS[1] = (save) => ({ ...save, world: { ...save.world, newField: 기본값 }, schemaVersion: 2 })
 */
const MIGRATIONS: Record<number, (save: SaveGame) => SaveGame> = {
  // v1 → v2: 재정·이적·훈련 필드 추가, 시즌 기록 키에 구단 id 포함
  1: (save) => {
    const w = save.world;
    const seasonStats: typeof w.seasonStats = {};
    for (const s of Object.values(w.seasonStats)) seasonStats[`${s.seasonId}:${s.playerId}:${s.clubId}`] = s;
    const format = { ...TEST_FORMAT, ...w.competition.format };
    return {
      ...save,
      schemaVersion: 2,
      world: {
        ...w,
        competition: { ...w.competition, format },
        seasonStats,
        finance: { ledger: [] },
        transfers: [],
        incomingOffers: [],
        training: Object.fromEntries(Object.keys(w.clubs).map((id) => [id, { ...DEFAULT_TRAINING }])),
        trainingReports: [],
      },
    };
  },
};

export class SaveVersionError extends Error {}

export function migrateSave(raw: SaveGame): SaveGame {
  let save = raw;
  if (typeof save.schemaVersion !== 'number') throw new SaveVersionError('세이브 버전 정보가 없습니다.');
  if (save.schemaVersion > WORLD_SCHEMA_VERSION) {
    throw new SaveVersionError(`이 세이브는 더 새로운 버전(v${save.schemaVersion})에서 만들어졌습니다. 게임을 업데이트하세요.`);
  }
  while (save.schemaVersion < WORLD_SCHEMA_VERSION) {
    const m = MIGRATIONS[save.schemaVersion];
    if (!m) throw new SaveVersionError(`v${save.schemaVersion} 세이브를 변환할 수 없습니다.`);
    save = m(save);
  }
  // 누락 필드 기본값 (손상 방지)
  const world = save.world as Partial<SaveGame['world']>;
  if (world.liveMatch === undefined) save = { ...save, world: { ...save.world, liveMatch: null } };
  return save;
}
