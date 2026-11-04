import type { PlayerAppearance } from '../types';
import { HAIR_COLOR, SKIN } from '../engine/appearance';

type R = [number, number, number, number, string];

/** 16x18 격자 픽셀 캐릭터 (SVG 파츠 합성) */
export function PixelCharacter({ a, primary = '#3b5078', secondary = '#e8c46a', number, className = '', label }: {
  a: PlayerAppearance; primary?: string; secondary?: string; number?: number; className?: string; label?: string;
}) {
  const skin = SKIN[a.skin % SKIN.length];
  const hair = HAIR_COLOR[a.hairColor % HAIR_COLOR.length];
  const dark = '#1b1b2a';
  const r: R[] = [];
  const headW = 8 + (a.face % 2); // 8~9
  const hx = 8 - Math.floor(headW / 2);
  const bodyW = 10 + a.body; // 10~12
  const bx = 8 - Math.floor(bodyW / 2);
  // 몸통(유니폼) + 팔
  r.push([bx, 12, bodyW, 6, primary], [7, 12, 2, 1, secondary], [bx, 12, 1, 2, secondary], [bx + bodyW - 1, 12, 1, 2, secondary]);
  r.push([bx - 1, 13, 1, 4, skin], [bx + bodyW, 13, 1, 4, skin]);
  // 목, 머리
  r.push([7, 11, 2, 1, skin], [hx, 3, headW, 8, skin]);
  // 눈
  const ey = 6 + (a.eyes === 2 ? 1 : 0);
  const eh = a.eyes === 1 ? 2 : 1;
  r.push([hx + 2, ey, 1, eh, dark], [hx + headW - 3, ey, 1, eh, dark]);
  // 입
  r.push([7, 9, 2, 1, '#00000033']);
  // 수염
  if (a.facialHair === 1) r.push([hx + 1, 9, headW - 2, 1, hair], [7, 10, 2, 1, hair]);
  if (a.facialHair === 2) r.push([hx, 8, 1, 3, hair], [hx + headW - 1, 8, 1, 3, hair], [hx + 1, 10, headW - 2, 1, hair]);
  // 헤어
  switch (a.hair % 6) {
    case 0: r.push([hx, 2, headW, 2, hair]); break; // 짧은 머리
    case 1: r.push([hx - 1, 1, headW + 2, 3, hair], [hx - 1, 4, 1, 3, hair], [hx + headW, 4, 1, 3, hair]); break; // 덥수룩
    case 2: r.push([hx + 2, 0, headW - 4, 4, hair]); break; // 모히칸
    case 3: r.push([hx, 2, headW, 1, hair]); break; // 삭발에 가까움
    case 4: r.push([hx - 1, 1, headW + 2, 3, hair], [hx - 1, 4, 1, 6, hair], [hx + headW, 4, 1, 6, hair]); break; // 장발
    default: r.push([hx, 2, headW, 2, hair], [hx, 4, 3, 1, hair]); break; // 옆가르마
  }
  // 액세서리
  if (a.accessory === 1) r.push([hx - 1, 4, headW + 2, 1, secondary]); // 헤어밴드
  if (a.accessory === 2) r.push([hx + 1, ey - 1, 3, 1, dark], [hx + headW - 4, ey - 1, 3, 1, dark]); // 진한 눈썹
  return (
    <svg viewBox="-2 -2 20 22" className={className} role="img" aria-label={label} shapeRendering="crispEdges" style={{ background: 'linear-gradient(#26395f,#121f3b)' }}>
      {r.map(([x, y, w, h, c], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={c} />)}
      {number != null && <text x="8" y="16.6" fontSize="2.6" textAnchor="middle" fill={secondary} fontWeight="bold" fontFamily="monospace">{number}</text>}
    </svg>
  );
}
