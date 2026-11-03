/**
 * 경기 엔진 — 분 단위 이벤트 시뮬레이션.
 *
 * 원칙
 * - 결과를 한 번의 난수로 정하지 않는다. 매 분마다 점유 → 찬스 → 슈팅 → 유효슈팅 → 득점의
 *   여러 단계 확률을 양 팀의 실시간 전력(능력치·포지션 적합도·체력·컨디션·사기·전술·홈 이점)으로 계산한다.
 * - 난수 상태(rngState)를 경기 상태에 저장해 같은 입력이면 같은 결과가 재현된다.
 * - UI와 분리된 순수 로직. stepMinute()는 새 상태를 반환한다.
 */
import type {
  CompetitionFormat, Formation, MatchEvent, MatchEventType, MatchReport, Player, PlayerMatchStats, Position,
  Tactic, TeamMatchStats,
} from '../../types';
import { createRng, type Rng } from '../../utils/rng';
import { FORMATIONS } from '../tactics/formations';
import { clamp, effectiveRating, positionGroup } from '../ratings/ovr';
import { assignToFormation, selectionScore } from './lineup';

export type SideKey = 'home' | 'away';
export type MatchPhase = 'pre' | 'first' | 'halftime' | 'second' | 'finished';

export interface MatchSlot {
  position: Position;
  playerId: string | null;
}

export interface MatchSide {
  clubId: string;
  tactic: Tactic;
  slots: MatchSlot[];
  bench: string[];
  subsUsed: number;
  windowsUsed: number;
  /** 마지막으로 교체 창을 연 분 (같은 분의 교체는 한 창으로 간주) */
  lastWindowMinute: number | null;
  isUser: boolean;
  captainId: string | null;
}

export interface LivePlayer {
  id: string;
  clubId: string;
  side: SideKey;
  fitness: number;
  started: boolean;
  minuteIn: number;
  minuteOut: number | null;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  fouls: number;
  yellow: number;
  red: boolean;
  injured: boolean;
  injuryDays: number;
  ratingDelta: number;
}

export interface MatchState {
  fixtureId: string;
  seed: number;
  rngState: number;
  phase: MatchPhase;
  minute: number;
  addedFirst: number;
  addedSecond: number;
  home: MatchSide;
  away: MatchSide;
  score: { home: number; away: number };
  stats: { home: TeamMatchStats; away: TeamMatchStats };
  possessionTicks: { home: number; away: number };
  live: Record<string, LivePlayer>;
  events: MatchEvent[];
  eventSeq: number;
  maxSubs: number;
  maxWindows: number;
  /** 사용자 확인이 필요한 사건(부상·퇴장 등) 발생 시 자동 일시정지 신호 */
  attentionRequired: string | null;
}

export interface SideSetup {
  clubId: string;
  tactic: Tactic;
  starters: string[];
  bench: string[];
  captainId: string | null;
  isUser: boolean;
}

const emptyTeamStats = (): TeamMatchStats => ({
  goals: 0, shots: 0, shotsOnTarget: 0, possession: 50, passesAttempted: 0, passesCompleted: 0, fouls: 0, yellows: 0, reds: 0,
});

function buildSide(setup: SideSetup, formation: Formation, players: Record<string, Player>): MatchSide {
  const slots = FORMATIONS[formation].map((s, i) => ({ position: s.position, playerId: setup.starters[i] ?? null }));
  // 선발 수가 모자라면(데이터 문제) 빈 슬롯 그대로 — 엔진은 null 슬롯을 지원한다.
  void players;
  return {
    clubId: setup.clubId,
    tactic: { ...setup.tactic, formation },
    slots,
    bench: [...setup.bench],
    subsUsed: 0,
    windowsUsed: 0,
    lastWindowMinute: null,
    isUser: setup.isUser,
    captainId: setup.captainId,
  };
}

export function createMatch(params: {
  fixtureId: string;
  seed: number;
  home: SideSetup;
  away: SideSetup;
  players: Record<string, Player>;
  format: CompetitionFormat;
}): MatchState {
  const { fixtureId, seed, home, away, players, format } = params;
  const rng = createRng(seed);
  const state: MatchState = {
    fixtureId,
    seed,
    rngState: 0,
    phase: 'pre',
    minute: 0,
    addedFirst: rng.int(1, 4),
    addedSecond: rng.int(2, 7),
    home: buildSide(home, home.tactic.formation, players),
    away: buildSide(away, away.tactic.formation, players),
    score: { home: 0, away: 0 },
    stats: { home: emptyTeamStats(), away: emptyTeamStats() },
    possessionTicks: { home: 0, away: 0 },
    live: {},
    events: [],
    eventSeq: 0,
    maxSubs: format.maxSubstitutions,
    maxWindows: format.maxSubstitutionWindows,
    attentionRequired: null,
  };
  state.rngState = rng.getState();
  for (const side of ['home', 'away'] as const) {
    for (const slot of state[side].slots) {
      if (slot.playerId) addLive(state, side, slot.playerId, players, true, 0);
    }
  }
  return state;
}

function addLive(state: MatchState, side: SideKey, id: string, players: Record<string, Player>, started: boolean, minute: number) {
  const p = players[id];
  state.live[id] = {
    id, clubId: state[side].clubId, side, fitness: p?.status.fitness ?? 100, started, minuteIn: minute, minuteOut: null,
    goals: 0, assists: 0, shots: 0, shotsOnTarget: 0, saves: 0, fouls: 0, yellow: 0, red: false, injured: false, injuryDays: 0, ratingDelta: 0,
  };
}

/** 표시용 분: 추가시간은 45+2, 90+3 형태 */
export function displayMinute(state: Pick<MatchState, 'minute' | 'phase'>, minute = state.minute): string {
  if (minute > 90) return `90+${minute - 90}`;
  if (state.phase === 'first' || state.phase === 'halftime') {
    if (minute > 45) return `45+${minute - 45}`;
  }
  return `${minute}`;
}

// ───────────────────────── 팀 전력 계산 ─────────────────────────

export interface TeamStrength {
  attack: number;
  midfield: number;
  defense: number;
  goalkeeper: number;
  pace: number;
  onPitch: number;
}

function formFactor(p: Player): number {
  const mood = (p.status.condition + p.status.morale) / 2;
  return 0.94 + 0.12 * (mood / 100);
}

export function fitnessFactor(fitness: number): number {
  return 0.7 + 0.3 * clamp(fitness, 0, 100) / 100;
}

export function activeSlots(side: MatchSide, state: MatchState): { slot: MatchSlot; player: string }[] {
  return side.slots
    .filter((s) => s.playerId && !state.live[s.playerId]?.injured && !state.live[s.playerId]?.red)
    .map((s) => ({ slot: s, player: s.playerId! }));
}

export function teamStrength(state: MatchState, sideKey: SideKey, players: Record<string, Player>): TeamStrength {
  const side = state[sideKey];
  const t: TeamStrength = { attack: 0, midfield: 0, defense: 0, goalkeeper: 30, pace: 0, onPitch: 0 };
  let paceN = 0;
  for (const { slot, player } of activeSlots(side, state)) {
    const p = players[player];
    if (!p) continue;
    const live = state.live[player];
    const v = effectiveRating(p, slot.position) * fitnessFactor(live.fitness) * formFactor(p);
    const g = positionGroup(slot.position);
    t.onPitch++;
    if (g === 'GK') t.goalkeeper = v;
    else if (g === 'DF') { t.defense += v; t.midfield += v * 0.25; }
    else if (g === 'MF') { t.midfield += v; t.attack += v * 0.4; t.defense += v * 0.4; }
    else { t.attack += v; t.midfield += v * 0.3; }
    if (g !== 'GK') { t.pace += p.attributes.pace; paceN++; }
  }
  t.pace = paceN ? t.pace / paceN : 50;
  // 전술 보정
  const tac = side.tactic;
  if (tac.mentality === 'attacking') { t.attack *= 1.12; t.defense *= 0.9; }
  if (tac.mentality === 'defensive') { t.attack *= 0.86; t.defense *= 1.12; }
  if (tac.pressing === 'high') t.midfield *= 1.06;
  if (tac.pressing === 'low') { t.midfield *= 0.95; t.defense *= 1.03; }
  if (tac.passing === 'short') t.midfield *= 1.04;
  if (tac.passing === 'direct') t.midfield *= 0.96;
  if (tac.transition === 'counter-press') t.midfield *= 1.02;
  return t;
}

// ───────────────────────── 이벤트 ─────────────────────────

function pushEvent(state: MatchState, type: MatchEventType, side: SideKey | null, playerId: string | null, relatedPlayerId: string | null, text: string) {
  state.eventSeq++;
  state.events.push({
    id: `${state.fixtureId}-e${state.eventSeq}`,
    matchId: state.fixtureId,
    minute: state.minute,
    type,
    clubId: side ? state[side].clubId : null,
    playerId,
    relatedPlayerId,
    text,
  });
}

const other = (s: SideKey): SideKey => (s === 'home' ? 'away' : 'home');

function nameOf(players: Record<string, Player>, id: string | null): string {
  return (id && players[id]?.name) || '알 수 없음';
}

// ───────────────────────── 1분 진행 ─────────────────────────

/** 한 단계 진행 (불변). 하프타임·종료 전환도 이 함수가 처리한다. */
export function stepMinute(prev: MatchState, players: Record<string, Player>): MatchState {
  const state = structuredClone(prev);
  stepMinuteMut(state, players);
  return state;
}

/** 내부용: 상태를 직접 변경하며 1단계 진행 (AI 경기 일괄 시뮬레이션에 사용) */
export function stepMinuteMut(state: MatchState, players: Record<string, Player>): void {
  state.attentionRequired = null;
  if (state.phase === 'finished') return;
  const rng = createRng(state.rngState);

  if (state.phase === 'pre') {
    state.phase = 'first';
    state.minute = 0;
    pushEvent(state, 'kickoff', null, null, null, '킥오프! 경기가 시작됩니다.');
    state.rngState = rng.getState();
    return;
  }
  if (state.phase === 'halftime') {
    state.phase = 'second';
    state.minute = 45;
    pushEvent(state, 'second-half', null, null, null, '후반전이 시작됩니다.');
    state.rngState = rng.getState();
    return;
  }

  state.minute++;
  simulateMinute(state, players, rng);
  for (const side of ['home', 'away'] as const) {
    if (!state[side].isUser) aiManage(state, side, players, rng);
  }

  if (state.phase === 'first' && state.minute >= 45 + state.addedFirst) {
    state.phase = 'halftime';
    pushEvent(state, 'halftime', null, null, null, `전반 종료 ${state.score.home} : ${state.score.away}`);
  } else if (state.phase === 'second' && state.minute >= 90 + state.addedSecond) {
    state.phase = 'finished';
    finalizePossession(state);
    pushEvent(state, 'fulltime', null, null, null, `경기 종료 ${state.score.home} : ${state.score.away}`);
  }
  state.rngState = rng.getState();
}

function finalizePossession(state: MatchState) {
  const total = state.possessionTicks.home + state.possessionTicks.away || 1;
  state.stats.home.possession = Math.round((state.possessionTicks.home / total) * 100);
  state.stats.away.possession = 100 - state.stats.home.possession;
}

function simulateMinute(state: MatchState, players: Record<string, Player>, rng: Rng) {
  const hs = teamStrength(state, 'home', players);
  const as = teamStrength(state, 'away', players);
  const ht = state.home.tactic;
  const at = state.away.tactic;

  // 1) 점유
  let pHome = (hs.midfield ** 1.3) / (hs.midfield ** 1.3 + as.midfield ** 1.3 || 1);
  pHome += 0.025; // 홈 이점
  const possAdj = (t: Tactic) =>
    (t.passing === 'short' ? 0.04 : t.passing === 'direct' ? -0.04 : 0) +
    (t.tempo === 'slow' ? 0.02 : t.tempo === 'fast' ? -0.02 : 0) +
    (t.pressing === 'high' ? 0.02 : 0) +
    (t.mentality === 'defensive' ? -0.03 : 0);
  pHome += possAdj(ht) - possAdj(at);
  pHome = clamp(pHome, 0.22, 0.78);
  const atk: SideKey = rng.chance(pHome) ? 'home' : 'away';
  const def = other(atk);
  state.possessionTicks[atk]++;

  const aStr = atk === 'home' ? hs : as;
  const dStr = atk === 'home' ? as : hs;
  const aTac = state[atk].tactic;
  const dTac = state[def].tactic;

  // 2) 패스
  const passAcc = (aTac.passing === 'short' ? 0.86 : aTac.passing === 'direct' ? 0.72 : 0.8) + (aStr.midfield - dStr.midfield) / 2000;
  const attempts = rng.int(4, 7) + (aTac.passing === 'short' ? 2 : 0) - (aTac.passing === 'direct' ? 1 : 0);
  state.stats[atk].passesAttempted += attempts;
  state.stats[atk].passesCompleted += Math.round(attempts * clamp(passAcc + (rng.next() - 0.5) * 0.06, 0.55, 0.95));

  // 3) 찬스 발생 확률
  const ratio = (aStr.attack + 1) / (dStr.defense + 1);
  let pChance = 0.27 * Math.pow(ratio, 1.1);
  if (aTac.tempo === 'fast') pChance *= 1.08;
  if (aTac.tempo === 'slow') pChance *= 0.93;
  if (aTac.passing === 'direct') pChance *= 1.04;
  if (dTac.pressing === 'high') pChance *= 0.95;
  // 높은 수비 라인은 빠른 공격수에게 뒷공간을 내준다
  if (dTac.defensiveLine === 'high') pChance *= 1 + (aStr.pace - 62) / 160;
  if (dTac.defensiveLine === 'low') pChance *= 0.92;
  // 역습: 상대가 공격적이거나 라인이 높을 때 효과
  if (aTac.counterAttack && (dTac.mentality === 'attacking' || dTac.defensiveLine === 'high')) pChance *= 1.15;
  if (aTac.counterAttack && dTac.mentality === 'defensive') pChance *= 0.92;
  // 홈 이점
  pChance *= atk === 'home' ? 1.07 : 0.96;
  // 수적 열세
  pChance *= Math.pow(aStr.onPitch / Math.max(dStr.onPitch, 1), 1.3);
  pChance = clamp(pChance, 0.04, 0.6);

  if (rng.chance(pChance)) resolveChance(state, atk, players, rng, dStr);

  // 4) 파울·카드
  if (rng.chance(0.24)) resolveFoul(state, def, players, rng);

  // 5) 체력 소모·부상
  for (const side of ['home', 'away'] as const) {
    const tac = state[side].tactic;
    let mult = 1;
    if (tac.pressing === 'high') mult *= 1.25;
    if (tac.pressing === 'low') mult *= 0.85;
    if (tac.tempo === 'fast') mult *= 1.1;
    if (tac.transition === 'counter-press') mult *= 1.06;
    for (const { player } of activeSlots(state[side], state)) {
      const p = players[player];
      const live = state.live[player];
      const drain = 0.3 * (1.3 - (p?.attributes.stamina ?? 60) / 100 * 0.6) * mult;
      live.fitness = clamp(live.fitness - drain * (0.85 + rng.next() * 0.3), 0, 100);
    }
    if (rng.chance(0.0018 * (tac.pressing === 'high' ? 1.25 : 1))) resolveInjury(state, side, players, rng);
  }
}

function resolveChance(state: MatchState, atk: SideKey, players: Record<string, Player>, rng: Rng, dStr: TeamStrength) {
  const side = state[atk];
  const def = other(atk);
  const wide = side.tactic.attackFocus === 'wide';
  const central = side.tactic.attackFocus === 'central';
  const on = activeSlots(side, state).filter(({ slot }) => slot.position !== 'GK');
  if (!on.length) return;

  const shooterEntry = rng.weighted(on, ({ slot, player }) => {
    const p = players[player];
    const g = positionGroup(slot.position);
    const roleW = g === 'FW' ? 4 : slot.position === 'AM' ? 3 : g === 'MF' ? 1.4 : 0.45;
    const skill = wide && (g === 'FW' || slot.position === 'CB') ? p.attributes.heading * 0.6 + p.attributes.finishing * 0.4 : p.attributes.finishing;
    return roleW * (skill / 60) ** 2;
  });
  const shooter = players[shooterEntry.player];
  const sLive = state.live[shooter.id];
  const fit = fitnessFactor(sLive.fitness);

  state.stats[atk].shots++;
  sLive.shots++;

  const shootSkill = wide ? (shooter.attributes.heading + shooter.attributes.shooting) / 2 : shooter.attributes.shooting;
  const pOnTarget = clamp((0.22 + shootSkill / 300 + (central ? 0.03 : 0)) * (0.85 + 0.15 * fit), 0.15, 0.75);
  if (!rng.chance(pOnTarget)) {
    sLive.ratingDelta -= 0.04;
    pushEvent(state, 'shot', atk, shooter.id, null, `${shooter.name}의 슈팅이 골문을 벗어납니다.`);
    return;
  }
  state.stats[atk].shotsOnTarget++;
  sLive.shotsOnTarget++;
  sLive.ratingDelta += 0.12;

  const finishing = (shooter.attributes.finishing * 0.6 + shooter.attributes.composure * 0.4) * fit;
  const gk = Math.max(dStr.goalkeeper, 20);
  const pGoal = clamp(0.33 * Math.pow(finishing / 62, 0.9) / Math.pow(gk / 62, 0.8), 0.08, 0.65);

  const gkSlot = state[def].slots.find((s) => s.position === 'GK' && s.playerId && !state.live[s.playerId].injured && !state.live[s.playerId].red);
  if (rng.chance(pGoal)) {
    state.score[atk]++;
    state.stats[atk].goals++;
    sLive.goals++;
    sLive.ratingDelta += 1.05;
    // 도움
    let assister: Player | null = null;
    if (rng.chance(0.74)) {
      const mates = on.filter((e) => e.player !== shooter.id);
      if (mates.length) {
        const a = rng.weighted(mates, ({ slot, player }) => {
          const p = players[player];
          const g = positionGroup(slot.position);
          const roleW = g === 'MF' ? 3 : g === 'FW' ? 2.4 : 1;
          const skill = wide ? p.attributes.crossing : (p.attributes.vision + p.attributes.shortPassing) / 2;
          return roleW * (skill / 60) ** 2;
        });
        assister = players[a.player];
        state.live[assister.id].assists++;
        state.live[assister.id].ratingDelta += 0.65;
      }
    }
    // 실점 측 수비 평점 하락
    for (const { slot, player } of activeSlots(state[def], state)) {
      const g = positionGroup(slot.position);
      state.live[player].ratingDelta -= g === 'GK' ? 0.35 : g === 'DF' ? 0.22 : 0.06;
    }
    pushEvent(state, 'goal', atk, shooter.id, assister?.id ?? null,
      `⚽ 골! ${shooter.name}${assister ? ` (도움: ${assister.name})` : ''} — ${state.score.home} : ${state.score.away}`);
  } else {
    if (gkSlot?.playerId) {
      state.live[gkSlot.playerId].saves++;
      state.live[gkSlot.playerId].ratingDelta += 0.22;
    }
    pushEvent(state, 'save', atk, shooter.id, gkSlot?.playerId ?? null,
      `${shooter.name}의 유효 슈팅! ${gkSlot?.playerId ? nameOf(players, gkSlot.playerId) + ' 골키퍼가 막아냅니다.' : '수비가 걷어냅니다.'}`);
  }
}

function resolveFoul(state: MatchState, side: SideKey, players: Record<string, Player>, rng: Rng) {
  const on = activeSlots(state[side], state).filter(({ slot }) => slot.position !== 'GK');
  if (!on.length) return;
  const e = rng.weighted(on, ({ player }) => players[player].attributes.aggression + 20);
  const p = players[e.player];
  const live = state.live[p.id];
  live.fouls++;
  live.ratingDelta -= 0.04;
  state.stats[side].fouls++;
  const pYellow = 0.11 * (0.6 + p.attributes.aggression / 100) * (state[side].tactic.pressing === 'high' ? 1.15 : 1);
  if (rng.chance(0.004)) {
    sendOff(state, side, p, `🟥 ${p.name} 선수, 거친 반칙으로 즉시 퇴장!`);
  } else if (rng.chance(pYellow)) {
    live.yellow++;
    live.ratingDelta -= 0.35;
    state.stats[side].yellows++;
    if (live.yellow >= 2) {
      sendOff(state, side, p, `🟥 ${p.name} 선수, 경고 누적으로 퇴장!`);
    } else {
      pushEvent(state, 'yellow', side, p.id, null, `🟨 ${p.name} 선수에게 옐로카드.`);
    }
  } else if (rng.chance(0.3)) {
    pushEvent(state, 'foul', side, p.id, null, `${p.name}의 반칙. 프리킥이 주어집니다.`);
  }
}

function sendOff(state: MatchState, side: SideKey, p: Player, text: string) {
  const live = state.live[p.id];
  live.red = true;
  live.ratingDelta -= 1.5;
  live.minuteOut = state.minute;
  state.stats[side].reds++;
  const slot = state[side].slots.find((s) => s.playerId === p.id);
  if (slot) slot.playerId = null;
  pushEvent(state, 'red', side, p.id, null, text);
  if (state[side].isUser) state.attentionRequired = text;
}

function resolveInjury(state: MatchState, side: SideKey, players: Record<string, Player>, rng: Rng) {
  const on = activeSlots(state[side], state);
  if (!on.length) return;
  const e = rng.weighted(on, ({ player }) => 110 - state.live[player].fitness);
  const live = state.live[e.player];
  live.injured = true;
  live.injuryDays = rng.weighted([3, 7, 14, 21, 35, 56], (d) => (d <= 7 ? 5 : d <= 21 ? 2 : 0.6));
  const text = `🚑 ${players[e.player].name} 선수가 부상으로 쓰러졌습니다. (예상 결장 ${live.injuryDays}일)`;
  pushEvent(state, 'injury', side, e.player, null, text);
  if (state[side].isUser) state.attentionRequired = `${text} 교체가 필요합니다.`;
}

// ───────────────────────── 교체·전술 변경 ─────────────────────────

export interface SubCheck {
  ok: boolean;
  reason?: string;
}

export function canSubstitute(state: MatchState, sideKey: SideKey, outId: string, inId: string): SubCheck {
  const side = state[sideKey];
  if (state.phase === 'finished') return { ok: false, reason: '경기가 끝났습니다.' };
  if (side.subsUsed >= state.maxSubs) return { ok: false, reason: `교체 가능 횟수(${state.maxSubs}회)를 모두 사용했습니다.` };
  const isHalftime = state.phase === 'halftime' || state.phase === 'pre';
  const opensWindow = !isHalftime && side.lastWindowMinute !== state.minute;
  if (opensWindow && side.windowsUsed >= state.maxWindows) return { ok: false, reason: `교체 기회(${state.maxWindows}회)를 모두 사용했습니다. 하프타임에는 추가로 교체할 수 있습니다.` };
  if (!side.slots.some((s) => s.playerId === outId)) return { ok: false, reason: '나가는 선수가 경기장에 없습니다.' };
  if (!side.bench.includes(inId)) return { ok: false, reason: '들어갈 선수가 벤치에 없습니다.' };
  return { ok: true };
}

export function substitute(prev: MatchState, sideKey: SideKey, outId: string, inId: string, players: Record<string, Player>): MatchState {
  const check = canSubstitute(prev, sideKey, outId, inId);
  if (!check.ok) throw new Error(check.reason);
  const state = structuredClone(prev);
  substituteMut(state, sideKey, outId, inId, players);
  return state;
}

function substituteMut(state: MatchState, sideKey: SideKey, outId: string, inId: string, players: Record<string, Player>) {
  const side = state[sideKey];
  const isHalftime = state.phase === 'halftime' || state.phase === 'pre';
  if (!isHalftime && side.lastWindowMinute !== state.minute) {
    side.windowsUsed++;
    side.lastWindowMinute = state.minute;
  }
  side.subsUsed++;
  const slot = side.slots.find((s) => s.playerId === outId)!;
  slot.playerId = inId;
  side.bench = side.bench.filter((id) => id !== inId);
  const outLive = state.live[outId];
  outLive.minuteOut = state.minute;
  addLive(state, sideKey, inId, players, false, state.minute);
  pushEvent(state, 'substitution', sideKey, inId, outId, `🔁 교체: ${nameOf(players, inId)} IN, ${nameOf(players, outId)} OUT`);
}

/** 전술 변경. 포메이션이 바뀌면 현재 경기장 위 선수들을 새 슬롯에 재배치한다. */
export function changeTactic(prev: MatchState, sideKey: SideKey, tactic: Tactic, players: Record<string, Player>): MatchState {
  const state = structuredClone(prev);
  changeTacticMut(state, sideKey, tactic, players);
  return state;
}

function changeTacticMut(state: MatchState, sideKey: SideKey, tactic: Tactic, players: Record<string, Player>) {
  const side = state[sideKey];
  const formationChanged = side.tactic.formation !== tactic.formation;
  side.tactic = { ...tactic };
  if (formationChanged) {
    // 퇴장 선수 자리는 비워 둔 채로 재배치 (수적 열세 유지)
    const onPitch = side.slots.map((s) => s.playerId).filter((id): id is string => !!id);
    const assigned = assignToFormation(onPitch, tactic.formation, players);
    side.slots = FORMATIONS[tactic.formation].map((s, i) => ({ position: s.position, playerId: assigned[i] }));
  }
  pushEvent(state, 'tactic-change', sideKey, null, null, `📋 전술 변경: ${tactic.formation} · ${labelMentality(tactic.mentality)}`);
}

function labelMentality(m: Tactic['mentality']) {
  return m === 'attacking' ? '공격적' : m === 'defensive' ? '수비적' : '균형';
}

// ───────────────────────── AI 운영 ─────────────────────────

function aiManage(state: MatchState, sideKey: SideKey, players: Record<string, Player>, rng: Rng) {
  const side = state[sideKey];
  if (state.phase === 'finished') return;
  // 부상 선수 즉시 교체
  for (const s of side.slots) {
    if (s.playerId && state.live[s.playerId].injured) aiSub(state, sideKey, s.playerId, s.position, players);
  }
  // 체력 저하 교체 (후반 55분 이후)
  if (state.minute >= 55 && rng.chance(0.25)) {
    const tired = activeSlots(side, state)
      .filter(({ slot, player }) => slot.position !== 'GK' && state.live[player].fitness < 62)
      .sort((a, b) => state.live[a.player].fitness - state.live[b.player].fitness)[0];
    if (tired) aiSub(state, sideKey, tired.player, tired.slot.position, players);
  }
  // 스코어에 따른 전술 조정
  const diff = state.score[sideKey] - state.score[other(sideKey)];
  if (state.minute === 70 && diff < 0 && side.tactic.mentality !== 'attacking') {
    changeTacticMut(state, sideKey, { ...side.tactic, mentality: 'attacking' }, players);
  } else if (state.minute === 78 && diff > 0 && side.tactic.mentality !== 'defensive') {
    changeTacticMut(state, sideKey, { ...side.tactic, mentality: 'defensive' }, players);
  }
}

function aiSub(state: MatchState, sideKey: SideKey, outId: string, pos: Position, players: Record<string, Player>) {
  const side = state[sideKey];
  const candidates = side.bench.filter((id) => players[id] && (pos === 'GK') === (players[id].positions[0] === 'GK'));
  if (!candidates.length) return;
  const best = candidates.sort((a, b) => selectionScore(players[b], pos) - selectionScore(players[a], pos))[0];
  if (canSubstitute(state, sideKey, outId, best).ok) substituteMut(state, sideKey, outId, best, players);
}

/** 사용자 측이 자리를 비운 채 빠르게 진행할 때: 부상 선수만 자동 교체 */
export function autoReplaceInjured(prev: MatchState, sideKey: SideKey, players: Record<string, Player>): MatchState {
  const state = structuredClone(prev);
  for (const s of state[sideKey].slots) {
    if (s.playerId && state.live[s.playerId].injured) aiSub(state, sideKey, s.playerId, s.position, players);
  }
  return state;
}

/** 끝까지 한 번에 시뮬레이션 (AI 경기용, 상태 직접 변경) */
export function simulateToEnd(state: MatchState, players: Record<string, Player>, opts: { assistUser?: boolean } = {}): MatchState {
  let guard = 0;
  while (state.phase !== 'finished' && guard++ < 200) {
    stepMinuteMut(state, players);
    if (opts.assistUser) {
      for (const sideKey of ['home', 'away'] as const) {
        if (!state[sideKey].isUser) continue;
        for (const s of state[sideKey].slots) {
          if (s.playerId && state.live[s.playerId].injured) aiSub(state, sideKey, s.playerId, s.position, players);
        }
      }
    }
  }
  return state;
}

// ───────────────────────── 결과 정리 ─────────────────────────

export function buildReport(state: MatchState, players: Record<string, Player>, keepAllEvents: boolean): MatchReport {
  if (state.phase !== 'finished') throw new Error('경기가 아직 끝나지 않았습니다.');
  const endMinute = state.minute;
  const rng = createRng(state.seed ^ 0x9e3779b9);
  const result: PlayerMatchStats[] = [];
  for (const live of Object.values(state.live)) {
    const p = players[live.id];
    if (!p) continue;
    const side = live.side;
    const gf = state.score[side];
    const ga = state.score[other(side)];
    const minutes = Math.max(1, (live.minuteOut ?? endMinute) - live.minuteIn);
    const pos = state[side].slots.find((s) => s.playerId === live.id)?.position ?? p.positions[0];
    const g = positionGroup(pos);
    let rating = 6.0 + live.ratingDelta;
    rating += gf > ga ? 0.35 : gf === ga ? 0.05 : -0.25;
    if (ga === 0 && (g === 'GK' || g === 'DF') && minutes >= 60) rating += 0.6;
    rating += (effectiveRating(p, pos) - 65) / 45;
    rating += (rng.next() - 0.5) * 0.6;
    if (minutes < 20) rating = 6.0 + (rating - 6.0) * 0.5;
    rating = Math.round(clamp(rating, 3, 10) * 10) / 10;
    result.push({
      playerId: live.id, clubId: live.clubId, minutes, goals: live.goals, assists: live.assists, shots: live.shots,
      shotsOnTarget: live.shotsOnTarget, fouls: live.fouls, yellow: live.yellow, red: live.red, rating, started: live.started,
    });
  }
  const mom = [...result].sort((a, b) => b.rating - a.rating)[0];
  return {
    fixtureId: state.fixtureId,
    seed: state.seed,
    home: { ...state.stats.home },
    away: { ...state.stats.away },
    players: result,
    events: keepAllEvents ? state.events : state.events.filter((e) => e.type === 'goal' || e.type === 'red'),
    momPlayerId: mom?.playerId ?? null,
  };
}

/** 경기 후 선수 상태 반영에 필요한 정보 */
export function matchAftermath(state: MatchState): { playerId: string; fitness: number; injuryDays: number; red: boolean; yellow: number }[] {
  return Object.values(state.live).map((l) => ({ playerId: l.id, fitness: l.fitness, injuryDays: l.injured ? l.injuryDays : 0, red: l.red, yellow: l.yellow }));
}
