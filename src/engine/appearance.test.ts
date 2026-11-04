import { describe, expect, it } from 'vitest';
import { appearanceOf, COUNTS, generateAppearance } from './appearance';

describe('픽셀 캐릭터 외형', () => {
  it('같은 id는 항상 같은 외형', () => {
    expect(generateAppearance('p-123')).toEqual(generateAppearance('p-123'));
  });
  it('값은 파츠 범위 안', () => {
    for (let i = 0; i < 300; i++) {
      const a = generateAppearance(`p-${i}`);
      for (const k of Object.keys(COUNTS) as (keyof typeof COUNTS)[]) {
        expect(a[k] ?? 0).toBeGreaterThanOrEqual(0);
        expect(a[k] ?? 0).toBeLessThan(COUNTS[k]);
      }
    }
  });
  it('300명 중 외형이 충분히 다양함', () => {
    const set = new Set(Array.from({ length: 300 }, (_, i) => JSON.stringify(generateAppearance(`p-${i}`))));
    expect(set.size).toBeGreaterThan(200);
  });
  it('저장된 appearance가 있으면 그대로 사용', () => {
    const saved = { v: 1 as const, body: 0, skin: 0, face: 0, eyes: 0, hair: 0, hairColor: 0, facialHair: 0 };
    expect(appearanceOf({ id: 'x', appearance: saved })).toBe(saved);
  });
});
