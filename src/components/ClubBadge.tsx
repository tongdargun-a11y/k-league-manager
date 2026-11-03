import type { Club } from '../types';
import { clubImageKey, useLocalImage } from '../store/localImages';

/**
 * 구단 배지. 사용자가 이 브라우저에 직접 추가한 개인용 로고가 있으면 그것을,
 * 없으면 자체 제작 원형 배지(구단 색상 + 약칭)를 표시한다. 엠블럼 파일은 저장소에 포함하지 않는다.
 */
export function ClubBadge({ club, size = 32 }: { club: Club | undefined; size?: number }) {
  const local = useLocalImage(club ? clubImageKey(club.id) : '');
  if (!club) return null;
  if (local) {
    return <img src={local} alt={club.name} title={club.name} className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-1 ring-white/20"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${club.colors.primary} 0 60%, ${club.colors.secondary} 60% 100%)`,
      }}
      title={club.name}
      aria-label={club.name}
    >
      {club.shortName.slice(0, 2)}
    </span>
  );
}
