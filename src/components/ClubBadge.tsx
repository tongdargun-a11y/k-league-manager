import type { Club } from '../types';

/** 엠블럼 권리 확인 전까지 사용하는 자체 제작 원형 배지 (구단 색상 + 약칭) */
export function ClubBadge({ club, size = 32 }: { club: Club | undefined; size?: number }) {
  if (!club) return null;
  const label = club.shortName.slice(0, 2);
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
      {label}
    </span>
  );
}
