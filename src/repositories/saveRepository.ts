import Dexie, { type Table } from 'dexie';
import type { SaveClubInfo, SaveGame, SaveSummary, WorldState } from '../types';
import { WORLD_SCHEMA_VERSION, isLegacySchema } from '../engine/world';
import { migrateSave } from './migrations';
import { uid } from '../utils/id';
import type { PlayerDataset } from '../engine/import/importPlayers';
import { buildBackup, planRestore, sameSaveContent, type BackupFile, type BackupImage } from './backup';

/**
 * IndexedDB 세이브 저장소 (Dexie).
 * - saves: 전체 세이브 (world 포함)
 * - summaries: 목록 화면용 요약 (world 없이 가볍게)
 * 두 테이블은 하나의 트랜잭션으로 함께 기록되어, 저장 중 탭이 닫혀도 반쪽 저장이 남지 않는다.
 */
class SaveDB extends Dexie {
  saves!: Table<SaveGame, string>;
  summaries!: Table<SaveSummary, string>;
  datasets!: Table<PlayerDataset, string>;
  images!: Table<LocalImage, string>;
  constructor() {
    super('k-league-manager');
    this.version(1).stores({
      saves: 'id, updatedAt',
      summaries: 'id, updatedAt',
    });
    // v2: 가져온 선수 데이터셋 (새 게임 생성용, 기존 세이브와 분리)
    this.version(2).stores({
      saves: 'id, updatedAt',
      summaries: 'id, updatedAt',
      datasets: 'id, importedAt',
    });
    // v3: 사용자가 직접 추가한 개인용 이미지 (이 브라우저에만 저장, 배포 빌드에 포함되지 않음)
    this.version(3).stores({
      saves: 'id, updatedAt',
      summaries: 'id, updatedAt',
      datasets: 'id, importedAt',
      images: 'key',
    });
  }
}

/** key: `club:<clubId>` 또는 `player:<playerId>` */
export interface LocalImage {
  key: string;
  blob: Blob;
  updatedAt: string;
}

const db = new SaveDB();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 전체 백업: 읽기만 하며 어떤 테이블도 수정하지 않는다. */
export const backupRepository = {
  async counts() {
    const [saves, datasets, images] = await Promise.all([db.saves.count(), db.datasets.count(), db.images.count()]);
    return { saves, datasets, images };
  },
  async exportAll(opts: { includeImages: boolean }): Promise<BackupFile> {
    return db.transaction('r', db.saves, db.datasets, db.images, async () => {
      const saves = await db.saves.toArray(); // 원본 그대로 (migrateSave 하지 않음)
      const datasets = await db.datasets.toArray();
      let images: BackupImage[] = [];
      if (opts.includeImages) {
        const rows = await db.images.toArray();
        images = await Promise.all(rows.map(async (r) => ({ key: r.key, dataUrl: await blobToDataUrl(r.blob), updatedAt: r.updatedAt })));
      }
      return buildBackup({ saves, datasets, images, appSaveSchemaVersion: WORLD_SCHEMA_VERSION, dbVersion: db.verno });
    });
  },

  /**
   * 백업 복구: 항상 새 id로 "추가"만 한다. add()는 같은 키가 있으면 실패하므로 기존 행을 덮어쓸 수 없다.
   * 전부 하나의 트랜잭션이라 중간에 실패하면 아무것도 저장되지 않는다.
   * 저장 후 다시 읽어 원본과 내용이 같은지 검사한다.
   */
  async restore(backup: BackupFile): Promise<{ saves: number; datasets: number; images: number; skippedImages: number; verified: boolean; problems: string[] }> {
    const existingImageKeys = new Set((await db.images.toCollection().primaryKeys()) as string[]);
    const plan = planRestore(backup, { newId: uid, existingImageKeys });
    // Dexie 트랜잭션 안에서는 fetch 같은 외부 비동기를 기다리면 안 되므로 이미지를 미리 변환
    const imageRows = await Promise.all(plan.images.map(async (m) => ({ key: m.key, blob: await (await fetch(m.dataUrl)).blob(), updatedAt: m.updatedAt })));
    await db.transaction('rw', db.saves, db.summaries, db.datasets, db.images, async () => {
      for (const { save } of plan.saves) {
        await db.saves.add(save);
        await db.summaries.add(toSummary(save));
      }
      for (const { dataset } of plan.datasets) await db.datasets.add(dataset);
      for (const row of imageRows) await db.images.add(row);
    });
    const problems: string[] = [];
    for (let i = 0; i < plan.saves.length; i++) {
      const stored = await db.saves.get(plan.saves[i].save.id);
      if (!stored || !sameSaveContent(stored, backup.saves[i])) problems.push(`세이브 '${backup.saves[i].name}' 내용 불일치`);
    }
    for (let i = 0; i < plan.datasets.length; i++) {
      const stored = await db.datasets.get(plan.datasets[i].dataset.id);
      if (!stored || JSON.stringify(stored.players) !== JSON.stringify(backup.datasets[i].players)) problems.push(`데이터셋 '${backup.datasets[i].name}' 내용 불일치`);
    }
    return { saves: plan.saves.length, datasets: plan.datasets.length, images: plan.images.length, skippedImages: backup.images.length - plan.images.length, verified: problems.length === 0, problems };
  },
};

export const imageRepository = {
  all: () => db.images.toArray(),
  put: (key: string, blob: Blob) => db.images.put({ key, blob, updatedAt: new Date().toISOString() }),
  remove: (key: string) => db.images.delete(key),
  clear: () => db.images.clear(),
};

function clubInfo(save: SaveGame): SaveClubInfo | undefined {
  const c = save.world?.clubs?.[save.selectedClubId];
  return c ? { id: c.id, name: c.name, shortName: c.shortName, colors: c.colors, founded: c.founded } : undefined;
}

function toSummary(save: SaveGame): SaveSummary {
  const { world: _world, ...rest } = save;
  void _world;
  return { ...rest, club: clubInfo(save) };
}

/** 세이브 목록 항목: 구버전 여부와 표시용 구단 정보 포함 */
export type SaveListItem = Omit<SaveSummary, 'club'> & { legacy: boolean; club: SaveClubInfo | null };

export class LegacySaveProtectedError extends Error {}

export const saveRepository = {
  /** 읽기 전용. 요약에 구단 정보가 없는 구버전 세이브는 세이브 본문에서 구단 이름·색상을 읽어 온다. */
  async list(): Promise<SaveListItem[]> {
    const rows = await db.summaries.orderBy('updatedAt').reverse().toArray();
    return Promise.all(rows.map(async (s) => {
      let club = s.club ?? null;
      if (!club) {
        const raw = await db.saves.get(s.id);
        club = (raw && clubInfo(raw)) ?? null;
      }
      return { ...s, club, legacy: isLegacySchema(s.schemaVersion) };
    }));
  },

  async load(id: string): Promise<SaveGame | null> {
    return (await this.loadForPlay(id))?.save ?? null;
  },

  /** 불러오기. 변환(마이그레이션)은 메모리에서만 하며 DB 행은 바꾸지 않는다. */
  async loadForPlay(id: string): Promise<{ save: SaveGame; legacy: boolean } | null> {
    const raw = await db.saves.get(id);
    if (!raw) return null;
    const legacy = typeof raw.schemaVersion === 'number' && isLegacySchema(raw.schemaVersion);
    return { save: migrateSave(raw), legacy };
  },

  async write(params: { id?: string; name: string; world: WorldState; createdAt?: string }): Promise<SaveGame> {
    // 안전장치: 구버전 원본 행에는 절대 덮어쓰지 않는다
    if (params.id) {
      const existing = await db.saves.get(params.id);
      if (existing && isLegacySchema(existing.schemaVersion)) throw new LegacySaveProtectedError('구버전 세이브 원본에는 저장할 수 없습니다.');
    }
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
    const existing = await db.saves.get(id);
    if (existing && isLegacySchema(existing.schemaVersion)) throw new LegacySaveProtectedError('구버전 세이브는 삭제할 수 없습니다.');
    await db.transaction('rw', db.saves, db.summaries, async () => {
      await db.saves.delete(id);
      await db.summaries.delete(id);
    });
  },
};

export type DatasetSummary = Omit<PlayerDataset, 'players'> & { playerCount: number; clubIds: string[] };

export const datasetRepository = {
  async list(): Promise<DatasetSummary[]> {
    const all = await db.datasets.orderBy('importedAt').reverse().toArray();
    return all.map(({ players, ...rest }) => ({ ...rest, playerCount: players.length, clubIds: [...new Set(players.map((p) => p.clubId))] }));
  },
  async get(id: string): Promise<PlayerDataset | undefined> {
    return db.datasets.get(id);
  },
  async add(ds: Omit<PlayerDataset, 'id' | 'importedAt'>): Promise<PlayerDataset> {
    const full: PlayerDataset = { ...ds, id: uid('ds'), importedAt: new Date().toISOString() };
    await db.datasets.put(full);
    return full;
  },
  async remove(id: string): Promise<void> {
    await db.datasets.delete(id);
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
