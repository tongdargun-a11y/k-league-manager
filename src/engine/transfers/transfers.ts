/**
 * 이적·계약 로직 (규칙 기반 AI). 금액은 '만원'.
 * 선수 가치·요구 연봉은 게임 밸런스용 추정치다.
 */
import type { CompetitionFormat, GameDate, IncomingOffer, Player, Transfer, WorldState } from '../../types';
import { FREE_AGENT, RETIRED } from '../../types';
import { playerOvr, positionGroup } from '../ratings/ovr';
import { ageOn, addDays, diffDays } from '../../utils/date';
import { createRng, hashString } from '../../utils/rng';
import { recordTx, weeklyWageBill } from '../finance/finance';
import { addInbox } from '../inbox';

// ───────────────────────── 가치 평가 ─────────────────────────

/** 선수 시장 가치 (만원) */
export function marketValue(p: Player, today: GameDate): number {
  const ovr = playerOvr(p);
  const age = ageOn(p.birthDate, today);
  const base = Math.max(0, ovr - 45) ** 2.4 * 2.2;
  const ageF = age <= 21 ? 1.35 : age <= 24 ? 1.2 : age <= 28 ? 1 : age <= 31 ? 0.7 : 0.4;
  const potF = 1 + Math.max(0, p.potential - ovr) / 40;
  const yearsLeft = Math.max(0, diffDays(p.contract.endDate, today) / 365);
  const contractF = yearsLeft < 0.5 ? 0.45 : yearsLeft < 1 ? 0.7 : yearsLeft < 2 ? 0.9 : 1;
  return roundMoney(base * ageF * potF * contractF);
}

/** 선수가 원하는 주급 (만원) */
export function wageDemand(p: Player, today: GameDate, buyerReputation: number): number {
  const ovr = playerOvr(p);
  const age = ageOn(p.birthDate, today);
  const base = (Math.max(0, ovr - 40) ** 2) * 1.7 + 60;
  const ageF = age >= 31 ? 0.85 : 1;
  // 평판 낮은 구단에는 더 많이 요구
  const repF = 1 + Math.max(0, 75 - buyerReputation) / 100;
  return roundMoney(base * ageF * repF, 10);
}

function roundMoney(v: number, unit = 100): number {
  return Math.max(unit, Math.round(v / unit) * unit);
}

export function isWindowOpen(format: CompetitionFormat, date: GameDate): boolean {
  const md = date.slice(5);
  return format.transferWindows.some((w) => md >= w.start && md <= w.end);
}

export function currentWindowLabel(format: CompetitionFormat, date: GameDate): string | null {
  const md = date.slice(5);
  return format.transferWindows.find((w) => md >= w.start && md <= w.end)?.label ?? null;
}

export function squadOf(world: WorldState, clubId: string): Player[] {
  return Object.values(world.players).filter((p) => p.clubId === clubId);
}

function isForeign(p: Player) {
  return p.nationality !== '대한민국';
}

/** 구단 내 해당 선수의 중요도: 포지션 그룹 내 순위 기반 (1 = 핵심) */
function importance(world: WorldState, p: Player): number {
  const g = positionGroup(p.positions[0]);
  const same = squadOf(world, p.clubId)
    .filter((x) => positionGroup(x.positions[0]) === g)
    .sort((a, b) => playerOvr(b) - playerOvr(a));
  const rank = same.findIndex((x) => x.id === p.id);
  const starters = g === 'GK' ? 1 : g === 'FW' ? 3 : 4;
  return rank < starters ? 1.45 : rank < starters * 2 ? 1.15 : 0.95;
}

function minAtGroup(world: WorldState, clubId: string, excludeId: string) {
  const squad = squadOf(world, clubId).filter((p) => p.id !== excludeId);
  return {
    total: squad.length,
    gk: squad.filter((p) => p.positions[0] === 'GK').length,
  };
}

// ───────────────────────── 사용자 → AI 영입 제안 ─────────────────────────

export type BidResponse =
  | { kind: 'accept'; fee: number }
  | { kind: 'counter'; fee: number; message: string }
  | { kind: 'reject'; message: string };

/** AI 구단이 사용자 제안(이적료)에 응답 */
export function evaluateBid(world: WorldState, playerId: string, fee: number): BidResponse {
  const p = world.players[playerId];
  if (!p) return { kind: 'reject', message: '선수를 찾을 수 없습니다.' };
  if (p.clubId === FREE_AGENT) return { kind: 'accept', fee: 0 };
  const today = world.clock.gameDate;
  const left = minAtGroup(world, p.clubId, p.id);
  if (left.total < world.competition.format.minSquadSize) return { kind: 'reject', message: '선수단 인원이 부족해 판매할 수 없다고 합니다.' };
  if (p.positions[0] === 'GK' && left.gk < 2) return { kind: 'reject', message: '골키퍼가 부족해 판매할 수 없다고 합니다.' };
  const asking = roundMoney(marketValue(p, today) * importance(world, p));
  if (fee >= asking) return { kind: 'accept', fee };
  if (fee >= asking * 0.75) return { kind: 'counter', fee: asking, message: `${formatShortMoney(asking)} 이상이면 보내겠다고 합니다.` };
  return { kind: 'reject', message: `제안 금액이 너무 낮다고 거절했습니다. (시장 가치의 ${Math.round((fee / Math.max(1, marketValue(p, today))) * 100)}%)` };
}

export type ContractResponse = { ok: true } | { ok: false; message: string; demand?: number };

/** 선수 개인 계약 협상 응답 */
export function evaluateContract(world: WorldState, playerId: string, wage: number, years: number, buyerClubId: string): ContractResponse {
  const p = world.players[playerId];
  const buyer = world.clubs[buyerClubId];
  if (!p || !buyer) return { ok: false, message: '잘못된 요청입니다.' };
  if (years < 1 || years > 5) return { ok: false, message: '계약 기간은 1~5년입니다.' };
  const today = world.clock.gameDate;
  const age = ageOn(p.birthDate, today);
  if (age >= 33 && years > 2) return { ok: false, message: '나이를 고려해 2년 이하 계약을 원합니다.' };
  const demand = wageDemand(p, today, buyer.reputation);
  const yearsF = years >= 4 ? 1.05 : years <= 1 ? 1.05 : 1;
  if (wage >= demand * yearsF) return { ok: true };
  return { ok: false, message: `주급 ${demand * yearsF >= 10000 ? formatShortMoney(demand * yearsF) : Math.round(demand * yearsF).toLocaleString() + '만 원'} 이상을 원합니다.`, demand: Math.round(demand * yearsF) };
}

function formatShortMoney(v: number) {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}억 원` : `${Math.round(v).toLocaleString()}만 원`;
}

export interface SigningCheck {
  ok: boolean;
  reason?: string;
}

/** 사용자 구단의 영입 가능 여부 (예산·인원·외국인·이적시장) */
export function canSign(world: WorldState, playerId: string, fee: number, wage: number): SigningCheck {
  const p = world.players[playerId];
  const club = world.clubs[world.userClubId];
  const fmt = world.competition.format;
  if (!p) return { ok: false, reason: '선수를 찾을 수 없습니다.' };
  if (p.clubId === world.userClubId) return { ok: false, reason: '이미 우리 팀 선수입니다.' };
  if (p.clubId !== FREE_AGENT && !isWindowOpen(fmt, world.clock.gameDate)) return { ok: false, reason: '이적시장 기간이 아닙니다. (무소속 선수는 언제든 영입 가능)' };
  if (fee > club.finances.transferBudget) return { ok: false, reason: '이적 예산이 부족합니다.' };
  const squad = squadOf(world, world.userClubId);
  if (squad.length >= fmt.maxSquadSize) return { ok: false, reason: `선수단이 최대 인원(${fmt.maxSquadSize}명)입니다.` };
  if (isForeign(p) && squad.filter(isForeign).length >= fmt.maxForeignPlayers) return { ok: false, reason: `외국인 선수 한도(${fmt.maxForeignPlayers}명)를 넘습니다.` };
  const bill = weeklyWageBill(world.userClubId, world.players);
  if (bill + wage > club.finances.wageBudget) return { ok: false, reason: `주급 예산을 넘습니다. (현재 ${bill.toLocaleString()} / 예산 ${club.finances.wageBudget.toLocaleString()}만 원)` };
  return { ok: true };
}

function nextShirtNumber(world: WorldState, clubId: string, preferred: number): number {
  const used = new Set(squadOf(world, clubId).map((p) => p.shirtNumber));
  if (!used.has(preferred)) return preferred;
  for (let n = 2; n < 100; n++) if (!used.has(n)) return n;
  return preferred;
}

/** 선수 이동 처리 (돈·계약·라인업·기록 모두 갱신). 순수 함수. */
export function executeTransfer(world: WorldState, params: { playerId: string; toClubId: string; fee: number; wage: number; years: number; type?: Transfer['type'] }): WorldState {
  const p = world.players[params.playerId];
  if (!p) return world;
  const from = p.clubId;
  const today = world.clock.gameDate;
  const endYear = Number(today.slice(0, 4)) + params.years - 1;
  const moved: Player = {
    ...p,
    clubId: params.toClubId,
    shirtNumber: params.toClubId === FREE_AGENT ? p.shirtNumber : nextShirtNumber(world, params.toClubId, p.shirtNumber),
    contract: params.toClubId === FREE_AGENT ? { ...p.contract, endDate: today, wage: 0 } : { startDate: today, endDate: `${endYear}-12-31`, wage: params.wage },
    status: { ...p.status, morale: Math.min(100, p.status.morale + 8) },
    gameOverride: { ...(p.gameOverride ?? {}), clubId: params.toClubId },
  };
  let w: WorldState = { ...world, players: { ...world.players, [p.id]: moved } };
  if (params.fee > 0) {
    w = recordTx(w, { date: today, clubId: params.toClubId, category: 'transfer-out', amount: -params.fee, note: `${p.name} 영입` });
    w = recordTx(w, { date: today, clubId: from, category: 'transfer-in', amount: params.fee, note: `${p.name} 판매` });
  }
  const transfer: Transfer = { id: `tr-${today}-${p.id}-${w.transfers.length}`, playerId: p.id, fromClubId: from, toClubId: params.toClubId, fee: params.fee, date: today, type: params.type ?? (from === FREE_AGENT ? 'free' : 'transfer') };
  // 사용자 라인업에서 제거
  const lu = w.userLineup;
  if (from === w.userClubId) {
    w = { ...w, userLineup: { ...lu, starters: lu.starters.filter((id) => id !== p.id), bench: lu.bench.filter((id) => id !== p.id), captainId: lu.captainId === p.id ? null : lu.captainId } };
  }
  // 이 선수에 대한 대기 중인 제안 정리
  w = { ...w, transfers: [transfer, ...w.transfers], incomingOffers: w.incomingOffers.map((o) => (o.playerId === p.id && o.status === 'pending' ? { ...o, status: 'withdrawn' as const } : o)) };
  const fromName = w.clubs[from]?.shortName ?? '무소속';
  const toName = w.clubs[params.toClubId]?.shortName ?? '무소속';
  if ((from === w.userClubId || params.toClubId === w.userClubId) && transfer.type !== 'contract-expired') {
    w = addInbox(w, {
      kind: 'info',
      title: params.toClubId === FREE_AGENT ? `${p.name} 방출` : `이적 완료: ${p.name}`,
      body: params.toClubId === FREE_AGENT ? `${p.name} 선수와 계약을 해지했습니다.` : `${p.name} 선수가 ${fromName}에서 ${toName}(으)로 이적했습니다. 이적료 ${params.fee ? formatShortMoney(params.fee) : '없음'}.`,
    });
  }
  return w;
}

/** 사용자 구단 선수 방출: 남은 계약의 50%를 보상금으로 지급 */
export function releaseCost(p: Player, today: GameDate): number {
  const weeksLeft = Math.max(0, diffDays(p.contract.endDate, today) / 7);
  return roundMoney(p.contract.wage * weeksLeft * 0.5, 10);
}

export function canRelease(world: WorldState, playerId: string): SigningCheck {
  const p = world.players[playerId];
  if (!p || p.clubId !== world.userClubId) return { ok: false, reason: '우리 팀 선수가 아닙니다.' };
  const left = minAtGroup(world, world.userClubId, playerId);
  if (left.total < world.competition.format.minSquadSize) return { ok: false, reason: `선수단 최소 인원(${world.competition.format.minSquadSize}명) 아래로 줄일 수 없습니다.` };
  if (p.positions[0] === 'GK' && left.gk < 2) return { ok: false, reason: '골키퍼는 최소 2명이 필요합니다.' };
  if (world.liveMatch) return { ok: false, reason: '경기 중에는 방출할 수 없습니다.' };
  return { ok: true };
}

export function releasePlayer(world: WorldState, playerId: string): WorldState {
  const p = world.players[playerId];
  const cost = releaseCost(p, world.clock.gameDate);
  let w = recordTx(world, { date: world.clock.gameDate, clubId: world.userClubId, category: 'compensation', amount: -cost, note: `${p.name} 계약 해지` });
  w = executeTransfer(w, { playerId, toClubId: FREE_AGENT, fee: 0, wage: 0, years: 0, type: 'release' });
  return w;
}

/** 계약 연장 */
export function renewContract(world: WorldState, playerId: string, wage: number, years: number): WorldState {
  const p = world.players[playerId];
  const endYear = Math.max(Number(p.contract.endDate.slice(0, 4)), Number(world.clock.gameDate.slice(0, 4))) + years;
  const updated: Player = { ...p, contract: { ...p.contract, wage, endDate: `${endYear}-12-31` }, status: { ...p.status, morale: Math.min(100, p.status.morale + 5) } };
  return addInbox({ ...world, players: { ...world.players, [p.id]: updated } }, { kind: 'info', title: `${p.name} 재계약`, body: `${p.name} 선수와 ${endYear}년 12월까지 재계약했습니다. 주급 ${wage.toLocaleString()}만 원.` });
}

// ───────────────────────── 받은 제안 ─────────────────────────

export function acceptIncomingOffer(world: WorldState, offerId: string): WorldState {
  const offer = world.incomingOffers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'pending') return world;
  const p = world.players[offer.playerId];
  if (!p || p.clubId !== world.userClubId) return world;
  const buyer = world.clubs[offer.fromClubId];
  let w = executeTransfer(world, { playerId: p.id, toClubId: offer.fromClubId, fee: offer.fee, wage: wageDemand(p, world.clock.gameDate, buyer.reputation), years: 3 });
  w = { ...w, incomingOffers: w.incomingOffers.map((o) => (o.id === offerId ? { ...o, status: 'completed' as const } : o)) };
  return w;
}

export function rejectIncomingOffer(world: WorldState, offerId: string): WorldState {
  return { ...world, incomingOffers: world.incomingOffers.map((o) => (o.id === offerId && o.status === 'pending' ? { ...o, status: 'rejected' as const } : o)) };
}

// ───────────────────────── 일일 이적 AI ─────────────────────────

/**
 * 하루 단위 이적 이벤트 (이적시장 기간 중):
 * - AI 구단이 사용자 선수에게 제안 (주 1~2회 확률)
 * - 인원이 부족한 AI 구단은 무소속 선수 영입
 * - 만료된 제안 정리
 * 날짜+월드 시드 기반 난수로 재현 가능.
 */
export function processTransferDay(world: WorldState, date: GameDate): WorldState {
  let w = world;
  // 제안 만료
  if (w.incomingOffers.some((o) => o.status === 'pending' && o.expiresOn < date)) {
    w = { ...w, incomingOffers: w.incomingOffers.map((o) => (o.status === 'pending' && o.expiresOn < date ? { ...o, status: 'expired' as const } : o)) };
  }
  const fmt = w.competition.format;
  const rng = createRng(hashString(`${w.worldSeed}:transfer:${date}`));

  // 무소속 선수 영입 (기간 무관, 인원 부족한 AI 구단)
  const free = Object.values(w.players).filter((p) => p.clubId === FREE_AGENT);
  if (free.length) {
    for (const club of Object.values(w.clubs)) {
      if (club.id === w.userClubId) continue;
      if (squadOf(w, club.id).length >= fmt.minSquadSize + 2) continue;
      const target = free.filter((p) => w.players[p.id].clubId === FREE_AGENT).sort((a, b) => playerOvr(b) - playerOvr(a))[0];
      if (!target) break;
      w = executeTransfer(w, { playerId: target.id, toClubId: club.id, fee: 0, wage: wageDemand(target, date, club.reputation), years: 1, type: 'free' });
    }
  }

  if (!isWindowOpen(fmt, date)) return w;

  // AI → 사용자 선수 제안 (하루 8% 확률, 대기 제안 2개 이하일 때)
  const pending = w.incomingOffers.filter((o) => o.status === 'pending').length;
  if (pending < 2 && rng.chance(0.08)) {
    const mine = squadOf(w, w.userClubId).filter((p) => !p.status.injuryId);
    const buyers = Object.values(w.clubs).filter((c) => c.id !== w.userClubId);
    if (mine.length > fmt.minSquadSize && buyers.length) {
      const target = rng.weighted(mine, (p) => Math.max(1, playerOvr(p) - 55) ** 2);
      const buyer = rng.weighted(buyers, (c) => c.finances.transferBudget);
      const value = marketValue(target, date);
      const fee = roundMoney(value * (0.85 + rng.next() * 0.45));
      if (fee <= buyer.finances.transferBudget) {
        const offer: IncomingOffer = { id: `offer-${date}-${target.id}`, playerId: target.id, fromClubId: buyer.id, fee, date, expiresOn: addDays(date, 7), status: 'pending' };
        w = { ...w, incomingOffers: [offer, ...w.incomingOffers].slice(0, 60) };
        w = addInbox(w, { kind: 'info', title: `이적 제안: ${target.name}`, body: `${buyer.name}이(가) ${target.name} 선수에게 ${formatShortMoney(fee)}을 제안했습니다. 이적시장 화면에서 7일 안에 답하세요.` });
      }
    }
  }
  return w;
}

/** 계약 만료 처리 (만료일 다음 날 무소속) + 60일 전 알림. */
export function processContracts(world: WorldState, date: GameDate): WorldState {
  let w = world;
  for (const p of Object.values(world.players)) {
    if (p.clubId === FREE_AGENT || p.clubId === RETIRED) continue;
    if (p.contract.endDate < date) {
      w = executeTransfer(w, { playerId: p.id, toClubId: FREE_AGENT, fee: 0, wage: 0, years: 0, type: 'contract-expired' });
      if (p.clubId === world.userClubId) w = addInbox(w, { kind: 'info', title: `${p.name} 계약 만료`, body: `${p.name} 선수의 계약이 끝나 팀을 떠났습니다.` });
    } else if (p.clubId === world.userClubId && diffDays(p.contract.endDate, date) === 60) {
      w = addInbox(w, { kind: 'info', title: `${p.name} 계약 만료 임박`, body: `${p.name} 선수의 계약이 60일 뒤(${p.contract.endDate}) 끝납니다. 선수 화면에서 재계약할 수 있습니다.` });
    }
  }
  return w;
}
