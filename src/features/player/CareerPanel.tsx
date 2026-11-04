import { Target } from 'lucide-react';
import type { Player } from '../../types';
import { useGame, useWorld } from '../../store/gameStore';
import { canRetire, interestedClub, requestTransfer, retireUserPlayer } from '../../engine/player/career';
import { isWindowOpen } from '../../engine/transfers/transfers';
import { Panel } from '../../components/ui';
import { SQUAD_ROLE_LABEL, squadRole } from '../../engine/player/userPlayer';
import { playerOvr } from '../../engine/ratings/ovr';

/** 선수 모드: 내 선수의 주전 경쟁·성장 현황 */
export function CareerPanel({ player }: { player: Player }) {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const save = () => void useGame.getState().saveGame({ silent: true });
  const windowOpen = isWindowOpen(world.competition.format, world.clock.gameDate);
  const target = windowOpen ? interestedClub(world) : null;
  const onTransfer = () => {
    const r = requestTransfer(world);
    if (!r.ok) return toast(r.message, 'warn');
    if (!window.confirm(`${world.clubs[target!.clubId].name}(으)로 이적할까요? 되돌릴 수 없습니다.`)) return;
    mutate(() => r.world); save(); toast(r.message, 'success');
  };
  const onRetire = () => {
    if (!window.confirm('정말 은퇴할까요? 되돌릴 수 없습니다.')) return;
    mutate(retireUserPlayer); save(); toast('은퇴했습니다. 그동안 수고했습니다!', 'info');
  };
  const { role, rankInGroup, groupSize } = squadRole(world, player.id);
  const ovr = playerOvr(player);
  const tone = role === 'starter' ? 'text-emerald-300' : role === 'bench' ? 'text-gold-300' : 'text-rose-300';
  return (
    <Panel title={<span className="flex items-center gap-2"><Target size={14} /> 내 커리어</span>}>
      <div className="grid gap-3 text-sm sm:grid-cols-3" data-testid="career-panel">
        <div><span className="text-xs text-slate-400">감독 평가 (다음 경기)</span><div className={`text-lg font-bold ${tone}`}>{SQUAD_ROLE_LABEL[role]}</div></div>
        <div><span className="text-xs text-slate-400">같은 포지션 그룹 순위</span><div className="text-lg font-bold">{rankInGroup} / {groupSize}</div></div>
        <div><span className="text-xs text-slate-400">성장</span><div className="text-lg font-bold">OVR {ovr} → 잠재력 {player.potential}</div></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
        <button className="btn-ghost" data-testid="request-transfer" disabled={!target} onClick={onTransfer}>이적 요청{target ? ` (${world.clubs[target.clubId].shortName} 관심)` : ''}</button>
        {canRetire(world) && <button className="btn-ghost text-rose-300" data-testid="retire" onClick={onRetire}>은퇴하기</button>}
        <span className="text-xs text-slate-500">{windowOpen ? (target ? '관심 구단이 있습니다.' : '지금은 관심 구단이 없습니다.') : '이적 요청은 이적시장 기간에만 할 수 있습니다.'} 계약이 끝나면 현재 능력 기준으로 자동 재계약됩니다.</span>
      </div>
      <p className="mt-2 text-xs text-slate-400">선발은 감독이 능력치와 컨디션으로 정합니다. 아래 '개인 훈련 집중'으로 키울 능력을 고르고, 출전 시간을 얻으면 더 빨리 성장합니다.</p>
    </Panel>
  );
}
