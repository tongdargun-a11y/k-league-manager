import { Navigate } from 'react-router-dom';
import { useWorld } from '../../store/gameStore';
import { userPlayerOf } from '../../engine/player/userPlayer';

/** 선수 모드: '내 선수' 메뉴 → 내 선수 프로필 */
export function MyPlayerRedirect() {
  const me = userPlayerOf(useWorld());
  return <Navigate to={me ? `/game/player/${me.id}` : '/game'} replace />;
}
