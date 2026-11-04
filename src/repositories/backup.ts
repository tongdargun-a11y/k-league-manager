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

// ───────────── 0-A2: 복구 ─────────────

export interface ParseResult {
  ok: boolean;
  backup: BackupFile | null;
  /** 파일 전체를 거부하는 오류 */
  errors: string[];
  /** 일부 항목만 건너뛰는 경고 */
  warnings: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function saveProblem(s: unknown, maxSchema: number): string | null {
  if (!isObj(s)) return '세이브 형식이 아님';
  if (typeof s.id !== 'string' || !s.id) return 'id 없음';
  if (typeof s.schemaVersion !== 'number') return '세이브 버전 없음';
  if (s.schemaVersion > maxSchema) return `더 새로운 버전(v${s.schemaVersion}) 세이브`;
  const w = s.world;
  if (!isObj(w)) return 'world 없음';
  if (!isObj(w.clubs) || !isObj(w.players) || !Array.isArray(w.fixtures) || !isObj(w.clock) || typeof w.userClubId !== 'string') return 'world 필수 항목 누락';
  return null;
}

/**
 * 백업 파일 문자열을 검사한다. 파일 자체가 잘못되면 전체 거부,
 * 개별 세이브·데이터셋·이미지가 잘못되면 그 항목만 빼고 경고로 알린다.
 */
export function parseBackup(text: string, maxSchema: number): ParseResult {
  const fail = (msg: string): ParseResult => ({ ok: false, backup: null, errors: [msg], warnings: [] });
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return fail('JSON 파일을 읽을 수 없습니다.'); }
  if (!isObj(raw)) return fail('백업 파일 형식이 아닙니다.');
  if (raw.format !== BACKUP_FORMAT) return fail('이 게임의 전체 백업 파일이 아닙니다.');
  if (typeof raw.backupVersion !== 'number' || raw.backupVersion > BACKUP_VERSION) return fail('지원하지 않는 백업 파일 버전입니다.');
  if (!Array.isArray(raw.saves) || !Array.isArray(raw.datasets) || !Array.isArray(raw.images)) return fail('백업 파일에 필요한 목록이 없습니다.');

  const warnings: string[] = [];
  const saves: SaveGame[] = [];
  raw.saves.forEach((s, i) => {
    const p = saveProblem(s, maxSchema);
    if (p) warnings.push(`세이브 ${i + 1}번 건너뜀: ${p}`);
    else saves.push(s as unknown as SaveGame);
  });
  const datasets: PlayerDataset[] = [];
  raw.datasets.forEach((d, i) => {
    if (isObj(d) && typeof d.id === 'string' && Array.isArray(d.players)) datasets.push(d as unknown as PlayerDataset);
    else warnings.push(`데이터셋 ${i + 1}번 건너뜀: 형식 오류`);
  });
  const images: BackupImage[] = [];
  raw.images.forEach((m, i) => {
    if (isObj(m) && typeof m.key === 'string' && typeof m.dataUrl === 'string' && m.dataUrl.startsWith('data:')) images.push(m as unknown as BackupImage);
    else warnings.push(`이미지 ${i + 1}번 건너뜀: 형식 오류`);
  });
  if (saves.length + datasets.length + images.length === 0) return { ok: false, backup: null, errors: ['복구할 수 있는 항목이 없습니다.'], warnings };
  const backup: BackupFile = { ...(raw as unknown as BackupFile), saves, datasets, images, counts: { saves: saves.length, datasets: datasets.length, images: images.length } };
  return { ok: true, backup, errors: [], warnings };
}

export interface RestorePlan {
  saves: { save: SaveGame; originalId: string }[];
  datasets: { dataset: PlayerDataset; originalId: string }[];
  images: BackupImage[];
}

/**
 * 복구 계획: 모든 세이브·데이터셋에 새 id를 붙인다 (기존 데이터 덮어쓰기 방지).
 * 세이브 내용(world, schemaVersion 등)은 바꾸지 않는다. 이름 뒤에만 "(복구)"를 붙인다.
 * 이미 같은 키가 있는 개인 이미지는 건너뛴다.
 */
export function planRestore(backup: BackupFile, opts: { newId: (prefix: string) => string; existingImageKeys: Set<string> }): RestorePlan {
  return {
    saves: backup.saves.map((s) => ({ originalId: s.id, save: { ...s, id: opts.newId('save'), name: `${s.name} (복구)` } })),
    datasets: backup.datasets.map((d) => ({ originalId: d.id, dataset: { ...d, id: opts.newId('ds') } })),
    images: backup.images.filter((m) => !opts.existingImageKeys.has(m.key)),
  };
}

/** 복구 후 무결성 검사: 원본과 저장된 결과의 내용(id·이름 제외)이 같은지 비교 */
export function sameSaveContent(a: SaveGame, b: SaveGame): boolean {
  const strip = ({ id: _i, name: _n, ...rest }: SaveGame) => { void _i; void _n; return rest; };
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
