import type { Player, PlayerAppearance } from '../types';

/** 외형 파츠 팔레트 (실존 인물과 무관한 조합형 픽셀 캐릭터) */
export const SKIN = ['#f6d7b8', '#eec39a', '#d9a066', '#b97a4a', '#8d5a36', '#5e3b22'];
export const HAIR_COLOR = ['#1f1a17', '#3b2a1e', '#6b4423', '#a0682f', '#d8b25a', '#8a8a8a', '#b5462e'];
export const COUNTS = { body: 3, skin: SKIN.length, face: 3, eyes: 3, hair: 6, hairColor: HAIR_COLOR.length, facialHair: 3, accessory: 3 } as const;

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 선수 id로 항상 같은 외형을 만든다 (세이브를 바꾸지 않음) */
export function generateAppearance(seed: string): PlayerAppearance {
  let h = hash(seed);
  const pick = (n: number) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    return h % n;
  };
  return {
    v: 1,
    body: pick(COUNTS.body),
    skin: pick(COUNTS.skin),
    face: pick(COUNTS.face),
    eyes: pick(COUNTS.eyes),
    hair: pick(COUNTS.hair),
    hairColor: pick(COUNTS.hairColor),
    facialHair: pick(5) < 4 ? 0 : 1 + pick(COUNTS.facialHair - 1),
    accessory: pick(6) === 0 ? 1 + pick(COUNTS.accessory - 1) : 0,
  };
}

export function appearanceOf(p: Pick<Player, 'id' | 'appearance'>): PlayerAppearance {
  return p.appearance ?? generateAppearance(p.id);
}
