import type { WorldState } from '../../types';
import { RETIRED } from '../../types';
import { executeTransfer, isWindowOpen, marketValue, squadOf, wageDemand } from '../transfers/transfers';
import { pickBestLineup } from '../match/lineup';
import { playerOvr } from '../ratings/ovr';
import { addInbox } from '../inbox';
import { ageOn } from '../../utils/date';
import { playerState } from './userPlayer';

/** 선수 모드 커리어: 이적 요청·재계약·은퇴 (PHASE 3-3) */

const teamLevel = (w: WorldState, clubId: string) => {
  const ovrs = squadOf(w, clubId).map(playerOvr).sort((a, b) => b - a).slice(0, 11);
  return ovrs.reduce((s, x) => s + x, 0) / Math.max(1, ovrs.length);
};

/** 내 선수를 데려갈 구단: 내 능력이 그 팀 주전 평균 -2 이상이고 이적료를 낼 수 있는 곳 중 평판이 가장 높은 구단 */
export function interestedClub(w: WorldState): { clubId: string; fee: number } | null {
  const st = playerState(w);
  if (!st) return null;
  const me = w.players[st.userPlayerId];
  const fee = Math.round(marketValue(me, w.clock.gameDate) / 100) * 100;
  const fmt = w.competition.format;
  const cands = Object.values(w.clubs)
    .filter((c) => c.id !== me.clubId && c.finances.transferBudget >= fee && squadOf(w, c.id).length < fmt.maxSquadSize && playerOvr(me) >= teamLevel(w, c.id) - 2)
    .sort((a, b) => b.reputation - a.reputation);
  return cands[0] ? { clubId: cands[0].id, fee } : null;
}

export function requestTransfer(w: WorldState): { world: WorldState; ok: boolean; message: string } {
  const st = playerState(w);
  if (!st) return { world: w, ok: false, message: '선수 모드에서만 가능합니다.' };
  const me = w.players[st.userPlayerId];
  if (me.clubId === RETIRED) return { world: w, ok: false, message: '은퇴한 선수입니다.' };
  if (!isWindowOpen(w.competition.format, w.clock.gameDate)) return { world: w, ok: false, message: '이적시장 기간에만 이적을 요청할 수 있습니다.' };
  const target = interestedClub(w);
  if (!target) return { world: w, ok: false, message: '지금은 관심을 보이는 구단이 없습니다. 능력을 더 키워 보세요.' };
  const to = w.clubs[target.clubId];
  const wage = Math.max(me.contract.wage, wageDemand(me, w.clock.gameDate, to.reputation));
  let next = executeTransfer(w, { playerId: me.id, toClubId: to.id, fee: target.fee, wage, years: 3 });
  // 선수 모드에서는 내 구단 = 내 선수의 소속
  next = {
    ...next,
    userClubId: to.id,
    userLineup: pickBestLineup(to.id, next.players, next.tactics[to.id].formation, next.competition.format.benchSize),
    manager: { ...next.manager, clubHistory: [...next.manager.clubHistory.map((h) => (h.to ? h : { ...h, to: w.clock.gameDate })), { clubId: to.id, from: w.clock.gameDate, to: null }] },
  };
  const message = `${to.name}(으)로 이적했습니다. 이적료 ${(target.fee / 10000).toFixed(1)}억 원, 주급 ${wage.toLocaleString()}만 원, 3년 계약.`;
  next = addInbox(next, { kind: 'info', title: `이적: ${to.shortName}`, body: message });
  return { world: next, ok: true, message };
}

export const canRetire = (w: WorldState) => {
  const st = playerState(w);
  if (!st) return false;
  const me = w.players[st.userPlayerId];
  return me.clubId !== RETIRED && ageOn(me.birthDate, w.clock.gameDate) >= 30;
};

export function retireUserPlayer(w: WorldState): WorldState {
  const st = playerState(w);
  if (!st || !canRetire(w)) return w;
  const me = w.players[st.userPlayerId];
  const next: WorldState = { ...w, players: { ...w.players, [me.id]: { ...me, clubId: RETIRED, contract: { ...me.contract, wage: 0, endDate: w.clock.gameDate } } } };
  return addInbox(next, { kind: 'info', title: '은퇴', body: `${me.name} 선수가 현역에서 은퇴했습니다. 선수 화면에서 커리어 기록을 볼 수 있습니다.` });
}
