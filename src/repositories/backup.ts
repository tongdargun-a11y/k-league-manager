import type { SaveGame } from '../types';
import type { PlayerDataset } from '../engine/import/importPlayers';

/**
 * 전체 백업 파일 형식 (PHASE 0-A1).
 * - saves: IndexedDB에 저장된 원본 그대로 (마이그레이션하지 않음 → 구버전 세이브도 원래 모습으로 보존)
 * - datasets: 가져온 선수 데이터셋
 * - images: 개인 이미지 (선택, data URL)
 */
export const BACKUP_FORMAT = 'vfm-backup';
export const BACKUP_VERSION = 1;

export interface BackupImage {
  key: string;
  dataUrl: string;
  updatedAt: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  backupVersion: number;
  exportedAt: string;
  /** 백업을 만든 앱의 세이브 스키마 버전 (참고용) */
  appSaveSchemaVersion: number;
  /** IndexedDB 데이터베이스 버전 (참고용, 세이브 스키마와 별개) */
  dbVersion: number;
  counts: { saves: number; datasets: number; images: number };
  saves: SaveGame[];
  datasets: PlayerDataset[];
  images: BackupImage[];
}

export function buildBackup(input: {
  saves: SaveGame[];
  datasets: PlayerDataset[];
  images?: BackupImage[];
  appSaveSchemaVersion: number;
  dbVersion: number;
  now?: string;
}): BackupFile {
  const images = input.images ?? [];
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt: input.now ?? new Date().toISOString(),
    appSaveSchemaVersion: input.appSaveSchemaVersion,
    dbVersion: input.dbVersion,
    counts: { saves: input.saves.length, datasets: input.datasets.length, images: images.length },
    saves: input.saves,
    datasets: input.datasets,
    images,
  };
}

export function backupFileName(exportedAt: string): string {
  return `vfm-backup-${exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
}
