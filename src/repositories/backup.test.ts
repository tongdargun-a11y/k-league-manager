import { describe, expect, it } from 'vitest';
import { buildBackup, backupFileName, BACKUP_FORMAT } from './backup';
import { createNewWorld } from '../engine/world';
import type { SaveGame } from '../types';

function legacySave(id: string, schemaVersion: number): SaveGame {
  const world = createNewWorld({ managerName: 'T', clubId: 'ulsan', seed: 1 });
  return { id, schemaVersion, name: id, createdAt: '2026-01-01', updatedAt: '2026-01-02', gameDate: world.clock.gameDate, managerName: 'T', selectedClubId: 'ulsan', world };
}

describe('전체 백업 (0-A1)', () => {
  it('세이브를 버전 변환 없이 원본 그대로 담는다', () => {
    const saves = [legacySave('a', 2), legacySave('b', 4)];
    const before = structuredClone(saves);
    const b = buildBackup({ saves, datasets: [], appSaveSchemaVersion: 4, dbVersion: 3, now: '2026-11-04T12:00:00.000Z' });
    expect(b.format).toBe(BACKUP_FORMAT);
    expect(b.counts).toEqual({ saves: 2, datasets: 0, images: 0 });
    expect(b.saves.map((s) => s.schemaVersion)).toEqual([2, 4]);
    expect(saves).toEqual(before); // 입력을 바꾸지 않음
  });

  it('JSON 문자열로 바꿨다 되돌려도 내용이 같다', () => {
    const b = buildBackup({ saves: [legacySave('a', 4)], datasets: [], appSaveSchemaVersion: 4, dbVersion: 3 });
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });

  it('파일 이름에 날짜·시간이 들어간다', () => {
    expect(backupFileName('2026-11-04T12:34:56.789Z')).toBe('vfm-backup-2026-11-04-12-34-56.json');
  });
});
