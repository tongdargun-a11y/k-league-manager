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

import { parseBackup, planRestore, sameSaveContent } from './backup';

describe('백업 복구 (0-A2)', () => {
  const good = () => buildBackup({ saves: [legacySave('a', 2), legacySave('b', 4)], datasets: [{ id: 'ds1', name: 'D', fileName: 'd.csv', importedAt: 'x', players: [] }], appSaveSchemaVersion: 4, dbVersion: 3 });

  it('정상 백업은 통과', () => {
    const r = parseBackup(JSON.stringify(good()), 4);
    expect(r.ok).toBe(true);
    expect(r.backup!.counts).toEqual({ saves: 2, datasets: 1, images: 0 });
  });

  it.each([
    ['깨진 JSON', '{ not json'],
    ['다른 형식', JSON.stringify({ format: 'other', saves: [] })],
    ['배열', '[]'],
    ['미래 백업 버전', JSON.stringify({ ...good(), backupVersion: 99 })],
    ['목록 누락', JSON.stringify({ format: 'vfm-backup', backupVersion: 1 })],
  ])('잘못된 파일 거부: %s', (_n, text) => {
    const r = parseBackup(text, 4);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('잘못된 세이브와 더 새로운 버전 세이브는 그 항목만 건너뜀', () => {
    const b = good();
    const bad = { ...b, saves: [...b.saves, { id: 'x' }, { ...legacySave('new', 9) }] };
    const r = parseBackup(JSON.stringify(bad), 4);
    expect(r.ok).toBe(true);
    expect(r.backup!.saves.map((s) => s.id)).toEqual(['a', 'b']);
    expect(r.warnings).toHaveLength(2);
  });

  it('복구는 항상 새 id를 쓰고 내용과 버전은 그대로 둔다', () => {
    const b = good();
    let n = 0;
    const plan = planRestore(b, { newId: (p) => `${p}-new${++n}`, existingImageKeys: new Set() });
    expect(plan.saves.map((s) => s.save.id)).toEqual(['save-new1', 'save-new2']);
    expect(plan.saves.map((s) => s.save.schemaVersion)).toEqual([2, 4]);
    expect(plan.datasets[0].dataset.id).toBe('ds-new3');
    plan.saves.forEach((s, i) => expect(sameSaveContent(s.save, b.saves[i])).toBe(true));
    expect(b.saves.map((s) => s.id)).toEqual(['a', 'b']); // 원본 백업 객체는 바뀌지 않음
  });

  it('이미 있는 개인 이미지 키는 덮어쓰지 않고 건너뜀', () => {
    const b = buildBackup({ saves: [], datasets: [], images: [{ key: 'club:a', dataUrl: 'data:,1', updatedAt: 'x' }, { key: 'club:b', dataUrl: 'data:,2', updatedAt: 'x' }], appSaveSchemaVersion: 4, dbVersion: 3 });
    const plan = planRestore(b, { newId: (p) => p, existingImageKeys: new Set(['club:a']) });
    expect(plan.images.map((m) => m.key)).toEqual(['club:b']);
  });

  it('내용이 다르면 무결성 검사 실패', () => {
    const a = legacySave('a', 4);
    const b = structuredClone(a);
    b.world.clock.gameDate = '2030-01-01';
    expect(sameSaveContent(a, b)).toBe(false);
  });
});
