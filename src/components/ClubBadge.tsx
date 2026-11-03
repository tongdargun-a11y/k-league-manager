import type { Club } from '../types';
import { clubImageKey, useLocalImage } from '../store/localImages';

/**
 * 구단 배지. 사용자가 이 브라우저에 직접 추가한 개인용 로고가 있으면 그것을,
 * 없으면 자체 디자인 방패 엠블럼(구단 색상 + 약칭)을 표시한다. 엠블럼 파일은 저장소에 포함하지 않는다.
 */
export function ClubBadge({ club, size = 32 }: { club: Club | undefined; size?: number }) {
  const local = useLocalImage(club ? clubImageKey(club.id) : '');
  if (!club) return null;
  if (local) {
    return <img src={local} alt={club.name} title={club.name} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  return <ShieldCrest club={club} size={size} />;
}

const SHIELD = 'M50 4 L92 16 V52 C92 80 72 98 50 108 C28 98 8 80 8 52 V16 Z';

/** 자체 디자인 방패 엠블럼: 구단 색상 + 약칭. 실제 엠블럼을 본뜨지 않는다. 무늬는 구단 id로 고정. */
function ShieldCrest({ club, size }: { club: Club; size: number }) {
  const { primary, secondary } = club.colors;
  const pattern = [...club.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 4;
  const clip = `crest-${club.id}`;
  const label = club.shortName.slice(0, 2);
  return (
    <svg viewBox="0 0 100 112" width={size} height={size * 1.12} className="shrink-0" role="img" aria-label={club.name}>
      <title>{club.name}</title>
      <defs><clipPath id={clip}><path d={SHIELD} /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="112" fill={primary} />
        {pattern === 0 && <path d="M0 70 L100 30 V50 L0 90 Z" fill={secondary} />}
        {pattern === 1 && <path d="M0 40 L50 70 L100 40 V58 L50 88 L0 58 Z" fill={secondary} />}
        {pattern === 2 && <rect x="50" width="50" height="112" fill={secondary} opacity="0.9" />}
        {pattern === 3 && <><rect x="20" width="14" height="112" fill={secondary} /><rect x="66" width="14" height="112" fill={secondary} /></>}
        <rect y="0" width="100" height="26" fill="#0b1630" opacity="0.55" />
      </g>
      <path d={SHIELD} fill="none" stroke="#e8c46a" strokeWidth="4" />
      {size >= 40 && <text x="50" y="19" textAnchor="middle" fontSize="11" fontWeight="700" fill="#e8c46a" letterSpacing="1">{club.founded ?? ''}</text>}
      <text x="50" y="68" textAnchor="middle" dominantBaseline="middle" fontSize="30" fontWeight="900" fill="#fff" stroke="#0b1630" strokeWidth="1.2" paintOrder="stroke">{label}</text>
    </svg>
  );
}
