import { useState } from 'react';
import type { Player } from '../types';
import { positionGroup } from '../engine/ratings/ovr';
import { playerImageKey, useLocalImage } from '../store/localImages';

/**
 * 선수 사진.
 * 우선순위: 권리 확인된 사진 → 사용자가 이 브라우저에 직접 추가한 개인용 사진 → 기본 실루엣.
 * 외부 이미지 핫링크는 하지 않는다.
 */
export function PlayerPhoto({ player, className = '' }: { player: Player; className?: string }) {
  const [failed, setFailed] = useState(false);
  const local = useLocalImage(playerImageKey(player.id));
  const verifiedPath = player.photoAssetId && player.meta.licenseStatus === 'verified' ? `${import.meta.env.BASE_URL}assets/players/${player.photoAssetId}` : null;
  if (verifiedPath && !failed) {
    return <img src={verifiedPath} alt={player.name} className={`object-cover ${className}`} onError={() => setFailed(true)} />;
  }
  if (local) return <img src={local} alt={player.name} className={`object-cover ${className}`} />;
  return <Silhouette group={positionGroup(player.positions[0])} className={className} label={player.name} />;
}

function Silhouette({ group, className, label }: { group: string; className: string; label: string }) {
  const tint = group === 'GK' ? '#e8c46a' : group === 'DF' ? '#60a5fa' : group === 'MF' ? '#34d399' : '#f87171';
  return (
    <svg viewBox="0 0 120 140" className={className} role="img" aria-label={`${label} (사진 없음)`}>
      <defs>
        <linearGradient id={`sil-${group}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26395f" />
          <stop offset="1" stopColor="#121f3b" />
        </linearGradient>
      </defs>
      <rect width="120" height="140" fill={`url(#sil-${group})`} />
      <circle cx="60" cy="52" r="24" fill="#3b5078" />
      <path d="M14 140c4-32 22-50 46-50s42 18 46 50z" fill="#3b5078" />
      <rect x="0" y="134" width="120" height="6" fill={tint} opacity="0.8" />
    </svg>
  );
}
