/**
 * 월드(세이브 전체 상태) 단위의 순수 로직: 새 게임 생성, 경기 결과 반영, 하루 진행.
 * 모든 함수는 입력 world를 변경하지 않고 새 world를 반환한다.
 */
import type {
  Club, Fixture, InboxItem, Injury, Lineup, Manager, MatchReport, Player, PlayerCareerStats, PlayerSeasonStats,
  Tactic, WorldState,
} from '../types';
import { DEFAULT_START_DATE, TEST_CLUBS, TEST_COMPETITION, DEFAULT_SEASON_YEAR } from '../data';
import { generateTestSquad } from '../data/testPlayers';
import { generateFixtures } from './calendar/schedule';
import { computeStandings } from './league/standings';
import { DEFAULT_TACTIC } from './tactics/formations';
import { pickBestLineup, sanitizeLineup } from './match/lineup';
import { buildReport, createMatch, matchAftermath, simulateToEnd, type MatchState } from './match/engine';
import { addDays } from '../utils/date';
import { hashString } from '../utils/rng';
import { addInbox } from './inbox';
export { addInbox } from './inbox';
import { clamp, playerOvr, positionGroup } from './ratings/ovr';
import { FREE_AGENT } from '../types';
import { TICKET_PRICE, estimateAttendance, prizeMoney, processMonthly, recordTx, weeklyWageBill } from './finance/finance';
import { processContracts, processTransferDay } from './transfers/transfers';
import { DEFAULT_TRAINING, INTENSITY_INJURY, INTENSITY_RECOVERY, planFor, processWeeklyTraining } from './training/training';
import { createRng } from '../utils/rng';
import { weekday } from '../utils/date';

export const WORLD_SCHEMA_VERSION = 2;

// ───────────────────────── 새 게임 ─────────────────────────

const AI_FORMATIONS: Tactic['formation'][] = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '4-1-4-1', '3-4-3'];

export function createNewWorld(params: { managerName: string; clubId: string; seed?: number; clubs?: Club[]; importedPlayers?: Player[] }): WorldState {
  const clubs = params.clubs ?? TEST_CLUBS;
  if (!clubs.some((c) => c.id === params.clubId)) throw new Error(`존재하지 않는 구단: ${params.clubId}`);
  const seed = params.seed ?? hashString(params.managerName + params.clubId) ^ 0x5bd1e995;
  const startDate = DEFAULT_START_DATE;
  const seasonId = `kleague1-${DEFAULT_SEASON_YEAR}`;
  const format = TEST_COMPETITION.format;

  const clubMap: Record<string, Club> = {};
  const players: Record<string, Player> = {};
  for (const c of clubs) {
    clubMap[c.id] = c;
    const imported = (params.importedPlayers ?? []).filter((p) => p.clubId === c.id);
    for (const p of mergeSquad(c, imported, startDate)) players[p.id] = p;
  }
  // 재정: 주급 예산은 현재 주급 총액 기준, 이적 예산은 평판 기준 (게임용 추정)
  for (const c of clubs) {
    const bill = weeklyWageBill(c.id, players);
    clubMap[c.id] = {
      ...c,
      finances: {
        balance: Math.round(bill * 4.33 * 3 + c.reputation * 1500),
        transferBudget: Math.round(c.reputation * 1000),
        wageBudget: Math.round((bill * 1.12) / 100) * 100,
      },
    };
  }
  const clubIds = clubs.map((c) => c.id);
  const fixtures = generateFixtures({ seasonId, competitionId: TEST_COMPETITION.id, clubIds, format, startDate })
    .map((f) => ({ ...f, seed: hashString(`${seed}:${f.id}`) }));

  const tactics: Record<string, Tactic> = {};
  for (const c of clubs) {
    tactics[c.id] = { ...DEFAULT_TACTIC, formation: AI_FORMATIONS[hashString(c.id) % AI_FORMATIONS.length] };
  }
  tactics[params.clubId] = { ...DEFAULT_TACTIC };

  const manager: Manager = {
    id: 'manager-1',
    name: params.managerName.trim() || '감독',
    nationality: '대한민국',
    tacticalStyle: 'balanced',
    reputation: 50,
    careerStartDate: startDate,
    clubHistory: [{ clubId: params.clubId, from: startDate, to: null }],
    record: { played: 0, won: 0, drawn: 0, lost: 0, trophies: 0 },
  };

  const lastDate = fixtures.reduce((m, f) => (f.date > m ? f.date : m), startDate);
  const world: WorldState = {
    competition: TEST_COMPETITION,
    season: {
      id: seasonId,
      competitionId: TEST_COMPETITION.id,
      label: `${DEFAULT_SEASON_YEAR} 시즌`,
      startDate,
      endDate: lastDate,
      status: 'active',
      clubIds,
      scheduleSource: 'test',
    },
    clubs: clubMap,
    players,
    fixtures,
    reports: {},
    seasonStats: {},
    injuries: [],
    tactics,
    userLineup: pickBestLineup(params.clubId, players, tactics[params.clubId].formation, format.benchSize),
    manager,
    userClubId: params.clubId,
    clock: { gameDate: startDate, lastProcessedDate: startDate, processedEventIds: [] },
    inbox: [],
    worldSeed: seed,
    liveMatch: null,
    finance: { ledger: [] },
    transfers: [],
    incomingOffers: [],
    training: Object.fromEntries(clubs.map((c) => [c.id, { ...DEFAULT_TRAINING }])),
    trainingReports: [],
  };
  const club = clubMap[params.clubId];
  return addInbox(world, {
    kind: 'info',
    title: `${club.name} 감독 부임`,
    body: `${manager.name} 감독님, ${club.name}에 오신 것을 환영합니다. 개막전까지 선수단과 전술을 점검하세요. (현재 선수 데이터는 테스트용 가상 데이터입니다.)`,
  });
}

// ───────────────────────── 경기 준비 ─────────────────────────

export function fixtureFor(world: WorldState, date: string, clubId: string): Fixture | undefined {
  return world.fixtures.find((f) => f.date === date && (f.homeClubId === clubId || f.awayClubId === clubId));
}

export function nextFixture(world: WorldState, clubId: string): Fixture | undefined {
  return world.fixtures
    .filter((f) => f.status !== 'played' && (f.homeClubId === clubId || f.awayClubId === clubId))
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

/** 경기 상태 생성. 사용자 구단은 저장된 라인업·전술을, AI는 자동 선발을 쓴다. */
export function prepareMatch(world: WorldState, fixture: Fixture): MatchState {
  const format = world.competition.format;
  const sideSetup = (clubId: string) => {
    const tactic = world.tactics[clubId] ?? DEFAULT_TACTIC;
    const isUser = clubId === world.userClubId;
    const lineup: Lineup = isUser
      ? sanitizeLineup(world.userLineup, clubId, world.players)
      : pickBestLineup(clubId, world.players, tactic.formation, format.benchSize);
    return {
      clubId,
      tactic: { ...tactic, formation: lineup.formation },
      starters: lineup.starters,
      bench: lineup.bench,
      captainId: lineup.captainId,
      isUser,
    };
  };
  return createMatch({
    fixtureId: fixture.id,
    seed: fixture.seed ?? hashString(`${world.worldSeed}:${fixture.id}`),
    home: sideSetup(fixture.homeClubId),
    away: sideSetup(fixture.awayClubId),
    players: world.players,
    format,
  });
}

// ───────────────────────── 경기 결과 반영 ─────────────────────────

function emptySeasonStats(playerId: string, seasonId: string, clubId: string): PlayerSeasonStats {
  return { playerId, seasonId, clubId, appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 0, ratingSum: 0, ratingCount: 0, cleanSheets: 0 };
}

/** 시즌·선수·구단별 기록 키 (시즌 중 이적하면 구단별로 따로 쌓인다) */
export function seasonStatsKey(seasonId: string, playerId: string, clubId: string) {
  return `${seasonId}:${playerId}:${clubId}`;
}

/** 이번 시즌 현재 소속 구단 기록 */
export function currentSeasonStats(world: WorldState, playerId: string): PlayerSeasonStats | undefined {
  const p = world.players[playerId];
  return p ? world.seasonStats[seasonStatsKey(world.season.id, playerId, p.clubId)] : undefined;
}

/**
 * 경기 결과를 월드에 반영한다. 같은 경기를 두 번 반영해도 한 번만 반영된다(멱등).
 * 선수 시즌 기록, 상태(체력·사기·경고·부상·징계), 일정 결과, 감독 기록을 동시에 갱신한다.
 */
export function applyMatchResult(world: WorldState, state: MatchState): WorldState {
  const fixture = world.fixtures.find((f) => f.id === state.fixtureId);
  if (!fixture) throw new Error(`경기를 찾을 수 없음: ${state.fixtureId}`);
  if (fixture.status === 'played') return world; // 이미 반영됨
  const isUserMatch = fixture.homeClubId === world.userClubId || fixture.awayClubId === world.userClubId;
  const report: MatchReport = buildReport(state, world.players, isUserMatch);
  const format = world.competition.format;
  const seasonId = world.season.id;
  const date = fixture.date;

  const players = { ...world.players };
  const seasonStats = { ...world.seasonStats };
  const injuries: Injury[] = [...world.injuries];
  let inboxAdds: Omit<InboxItem, 'id' | 'date' | 'read'>[] = [];

  // 1) 이번 경기에 뛸 수 없었던 징계 선수는 징계 1경기 차감
  for (const clubId of [fixture.homeClubId, fixture.awayClubId]) {
    for (const p of Object.values(players)) {
      if (p.clubId === clubId && p.status.suspendedMatches > 0 && !state.live[p.id]) {
        players[p.id] = { ...p, status: { ...p.status, suspendedMatches: p.status.suspendedMatches - 1 } };
      }
    }
  }

  // 2) 출전 선수 기록·상태
  const after = new Map(matchAftermath(state).map((a) => [a.playerId, a]));
  const gfBy = (clubId: string) => (clubId === fixture.homeClubId ? state.score.home : state.score.away);
  const gaBy = (clubId: string) => (clubId === fixture.homeClubId ? state.score.away : state.score.home);

  for (const ps of report.players) {
    const p = players[ps.playerId];
    if (!p) continue;
    const key = seasonStatsKey(seasonId, p.id, p.clubId);
    const s = { ...(seasonStats[key] ?? emptySeasonStats(p.id, seasonId, p.clubId)) };
    s.appearances++;
    if (ps.started) s.starts++;
    s.minutes += ps.minutes;
    s.goals += ps.goals;
    s.assists += ps.assists;
    s.yellowCards += ps.red ? 0 : ps.yellow;
    s.redCards += ps.red ? 1 : 0;
    s.ratingSum += ps.rating;
    s.ratingCount++;
    if (gaBy(p.clubId) === 0 && ps.minutes >= 60 && (p.positions[0] === 'GK' || ['CB', 'LB', 'RB'].includes(p.positions[0]))) s.cleanSheets++;
    seasonStats[key] = s;

    const a = after.get(p.id)!;
    const gf = gfBy(p.clubId);
    const ga = gaBy(p.clubId);
    const moraleDelta = (gf > ga ? 6 : gf === ga ? 0 : -6) + (ps.rating - 6.5) * 3;
    let suspended = p.status.suspendedMatches;
    let yellowCards = p.status.yellowCards + (ps.red ? 0 : ps.yellow);
    if (ps.red) suspended += 1;
    if (yellowCards >= format.yellowCardsForSuspension) {
      suspended += 1;
      yellowCards = 0;
      if (p.clubId === world.userClubId) inboxAdds.push({ kind: 'suspension', title: `${p.name} 경고 누적 징계`, body: `${p.name} 선수가 경고 누적으로 다음 경기에 출전할 수 없습니다.` });
    }
    if (ps.red && p.clubId === world.userClubId) inboxAdds.push({ kind: 'suspension', title: `${p.name} 퇴장 징계`, body: `${p.name} 선수가 퇴장으로 다음 경기에 출전할 수 없습니다.` });

    let injuryId = p.status.injuryId;
    if (a.injuryDays > 0) {
      const inj: Injury = { id: `inj-${fixture.id}-${p.id}`, playerId: p.id, type: injuryName(a.injuryDays), startDate: date, expectedReturnDate: addDays(date, a.injuryDays) };
      injuries.push(inj);
      injuryId = inj.id;
      if (p.clubId === world.userClubId) inboxAdds.push({ kind: 'injury', title: `${p.name} 부상`, body: `${p.name} 선수가 ${inj.type}으로 약 ${a.injuryDays}일 결장합니다. (복귀 예정 ${inj.expectedReturnDate})` });
    }
    const updated: Player = {
      ...p,
      status: {
        ...p.status,
        fitness: clamp(a.fitness, 0, 100),
        morale: clamp(p.status.morale + moraleDelta, 0, 100),
        condition: clamp(p.status.condition + (ps.rating - 6.4) * 4, 0, 100),
        sharpness: clamp(p.status.sharpness + ps.minutes / 9, 0, 100),
        yellowCards,
        suspendedMatches: suspended,
        injuryId,
      },
    };
    updated.peakOvr = Math.max(updated.peakOvr, playerOvr(updated));
    players[p.id] = updated;
  }

  // 3) 일정
  const fixtures = world.fixtures.map((f) =>
    f.id === fixture.id ? { ...f, status: 'played' as const, result: { homeGoals: state.score.home, awayGoals: state.score.away } } : f,
  );

  // 4) 감독 기록
  let manager = world.manager;
  if (isUserMatch) {
    const gf = gfBy(world.userClubId);
    const ga = gaBy(world.userClubId);
    manager = {
      ...manager,
      record: {
        ...manager.record,
        played: manager.record.played + 1,
        won: manager.record.won + (gf > ga ? 1 : 0),
        drawn: manager.record.drawn + (gf === ga ? 1 : 0),
        lost: manager.record.lost + (gf < ga ? 1 : 0),
      },
    };
    const home = world.clubs[fixture.homeClubId].shortName;
    const away = world.clubs[fixture.awayClubId].shortName;
    inboxAdds = [{ kind: 'result', title: `경기 결과: ${home} ${state.score.home} : ${state.score.away} ${away}`, body: `${fixture.round}라운드 경기가 끝났습니다.` }, ...inboxAdds];
  }

  let next: WorldState = {
    ...world,
    players,
    seasonStats,
    injuries,
    fixtures,
    manager,
    reports: { ...world.reports, [fixture.id]: report },
    liveMatch: world.liveMatch?.fixtureId === fixture.id ? null : world.liveMatch,
  };
  for (const item of inboxAdds) next = addInbox(next, item);
  // 홈 경기 입장 수입
  const homeClub = next.clubs[fixture.homeClubId];
  const names = Object.fromEntries(Object.values(next.clubs).map((c) => [c.id, c.name]));
  const rank = computeStandings(next.season.clubIds, next.fixtures, format, names).findIndex((r) => r.clubId === homeClub.id) + 1;
  const attendance = estimateAttendance(homeClub, rank || 6, next.season.clubIds.length);
  next = recordTx(next, { date, clubId: homeClub.id, category: 'gate', amount: Math.round(attendance * TICKET_PRICE), note: `${fixture.round}R 홈경기 관중 ${attendance.toLocaleString()}명` });
  return next;
}

/** 가져온 선수로 구단 선수단 구성. 부족하면 테스트 선수로 22명까지 채운다. 구단 내 등번호 중복은 정리한다. */
function mergeSquad(club: Club, imported: Player[], startDate: string): Player[] {
  if (!imported.length) return generateTestSquad(club, startDate);
  const squad = [...imported];
  const test = generateTestSquad(club, startDate);
  const need = (pred: (p: Player) => boolean, n: number) => {
    for (const t of test) {
      if (squad.filter(pred).length >= n) break;
      if (pred(t) && !squad.includes(t)) squad.push(t);
    }
  };
  need((p) => p.positions[0] === 'GK', 2);
  need((p) => positionGroup(p.positions[0]) === 'DF', 6);
  need((p) => positionGroup(p.positions[0]) === 'MF', 6);
  need((p) => positionGroup(p.positions[0]) === 'FW', 3);
  need(() => true, 22);
  const used = new Set<number>();
  return squad.map((p) => {
    let n = p.shirtNumber;
    if (!n || used.has(n)) { n = 1; while (used.has(n)) n++; }
    used.add(n);
    return n === p.shirtNumber ? p : { ...p, shirtNumber: n };
  });
}

function injuryName(days: number): string {
  if (days <= 3) return '가벼운 타박상';
  if (days <= 7) return '근육 경직';
  if (days <= 14) return '햄스트링 염좌';
  if (days <= 21) return '발목 염좌';
  if (days <= 35) return '종아리 근육 파열';
  return '무릎 인대 손상';
}

/** AI 경기 1개를 시뮬레이션하고 반영 */
export function simulateAndApply(world: WorldState, fixture: Fixture): WorldState {
  const state = simulateToEnd(prepareMatch(world, fixture), world.players);
  return applyMatchResult(world, state);
}

/** 해당 날짜(포함) 이전의 미진행 AI 경기를 모두 처리. 사용자 경기는 건드리지 않는다. */
export function simulateDueAIFixtures(world: WorldState, uptoDate: string): WorldState {
  let w = world;
  const due = w.fixtures.filter(
    (f) => f.status === 'scheduled' && f.date <= uptoDate && f.homeClubId !== w.userClubId && f.awayClubId !== w.userClubId,
  );
  for (const f of due) w = simulateAndApply(w, f);
  return w;
}

// ───────────────────────── 하루 진행 ─────────────────────────

export type StopReason = 'match-day' | 'season-end' | 'injury-return' | 'transfer-offer' | null;

export interface AdvanceResult {
  world: WorldState;
  advanced: boolean;
  stopReason: StopReason;
}

/**
 * 게임 날짜를 하루 진행한다.
 * 처리 순서: (오늘 남은 AI 경기 마감) → 날짜 증가 → 부상 회복 → 컨디션 회복 → 경기 확인 → 알림
 * 같은 날짜의 일일 처리는 processedEventIds로 한 번만 실행된다.
 */
export function advanceDay(world: WorldState): AdvanceResult {
  const today = world.clock.gameDate;
  // 사용자 경기가 오늘인데 아직 안 했다면 진행 불가
  const todays = fixtureFor(world, today, world.userClubId);
  if (todays && todays.status !== 'played') return { world, advanced: false, stopReason: 'match-day' };
  if (world.season.status === 'finished') return { world, advanced: false, stopReason: 'season-end' };

  // 오늘 남은 AI 경기 마감
  let w = simulateDueAIFixtures(world, today);

  const newDate = addDays(today, 1);
  const eventKey = `day:${newDate}`;
  let stopReason: StopReason = null;

  if (!w.clock.processedEventIds.includes(eventKey)) {
    // 1) 날짜 증가
    w = {
      ...w,
      clock: {
        gameDate: newDate,
        lastProcessedDate: newDate,
        processedEventIds: [...w.clock.processedEventIds, eventKey].slice(-120),
      },
    };
    // 2) 계약 만료
    w = processContracts(w, newDate);
    // 3) 부상 회복 + 체력·컨디션 회복 (훈련 강도 반영)
    const players = { ...w.players };
    const recovered: Player[] = [];
    const remainingInjuries = w.injuries.filter((inj) => {
      if (inj.expectedReturnDate <= newDate) {
        const p = players[inj.playerId];
        if (p && p.status.injuryId === inj.id) {
          players[p.id] = { ...p, status: { ...p.status, injuryId: null, fitness: Math.min(p.status.fitness, 80), sharpness: Math.max(30, p.status.sharpness - 20) } };
          recovered.push(p);
        }
        return false;
      }
      return true;
    });
    for (const p of Object.values(players)) {
      const st = players[p.id].status;
      const plan = planFor(w, p.clubId);
      const resting = (p.trainingFocus ?? plan.focus) === 'rest';
      const recover = st.injuryId ? 2 : 7 + p.attributes.stamina / 20 + INTENSITY_RECOVERY[plan.intensity] + (resting ? 3 : 0);
      players[p.id] = {
        ...players[p.id],
        status: {
          ...st,
          fitness: clamp(st.fitness + recover, 0, 100),
          condition: st.condition + (70 - st.condition) * 0.03,
          morale: clamp(st.morale + (65 - st.morale) * 0.02 + (resting ? 0.3 : 0), 0, 100),
          sharpness: clamp(st.sharpness - (resting ? 1 : 0.4), 20, 100),
        },
      };
    }
    w = { ...w, players, injuries: remainingInjuries };
    const mine = recovered.filter((p) => p.clubId === w.userClubId);
    for (const p of mine) {
      w = addInbox(w, { kind: 'injury', title: `${p.name} 부상 복귀`, body: `${p.name} 선수가 부상에서 회복해 훈련에 복귀했습니다.` });
    }
    if (mine.length) stopReason = 'injury-return';
    // 4) 훈련: 매일 훈련 부상 위험, 매주 월요일 성장 처리
    w = trainingInjuries(w, newDate);
    if (weekday(newDate) === 1) {
      w = processWeeklyTraining(w, newDate);
      const report = w.trainingReports[0];
      const grew = report?.entries.filter((e) => e.ovrAfter > e.ovrBefore) ?? [];
      if (grew.length) {
        w = addInbox(w, { kind: 'info', title: '주간 훈련 보고', body: `OVR이 오른 선수: ${grew.slice(0, 5).map((e) => `${w.players[e.playerId].name}(${e.ovrBefore}→${e.ovrAfter})`).join(', ')}${grew.length > 5 ? ` 외 ${grew.length - 5}명` : ''}` });
      }
    }
    // 5) 이적 이벤트
    const offersBefore = w.incomingOffers.length;
    w = processTransferDay(w, newDate);
    if (w.incomingOffers.length > offersBefore) stopReason = 'transfer-offer';
    // 재정: 매월 1일 정산
    if (newDate.endsWith('-01')) w = processMonthly(w, newDate);
  } else {
    w = { ...w, clock: { ...w.clock, gameDate: newDate } };
  }

  // 오늘 사용자 경기?
  const userFixture = fixtureFor(w, newDate, w.userClubId);
  if (userFixture && userFixture.status === 'scheduled') {
    const opp = w.clubs[userFixture.homeClubId === w.userClubId ? userFixture.awayClubId : userFixture.homeClubId];
    w = addInbox(w, { kind: 'match', title: `오늘 경기: vs ${opp.name}`, body: `${userFixture.round}라운드 경기일입니다. 대시보드에서 경기를 시작하세요.` });
    stopReason = 'match-day';
  }

  // 시즌 종료?
  w = checkSeasonEnd(w);
  if (w.season.status === 'finished') stopReason = 'season-end';
  return { world: w, advanced: true, stopReason };
}

function trainingInjuries(world: WorldState, date: string): WorldState {
  const rng = createRng(hashString(`${world.worldSeed}:train-injury:${date}`));
  let w = world;
  for (const p of Object.values(world.players)) {
    if (p.clubId === FREE_AGENT || p.status.injuryId) continue;
    const plan = planFor(world, p.clubId);
    if ((p.trainingFocus ?? plan.focus) === 'rest') continue;
    if (!rng.chance(INTENSITY_INJURY[plan.intensity])) continue;
    const days = rng.pick([3, 5, 7, 10, 14]);
    const inj: Injury = { id: `inj-train-${date}-${p.id}`, playerId: p.id, type: '훈련 중 근육 부상', startDate: date, expectedReturnDate: addDays(date, days) };
    w = { ...w, injuries: [...w.injuries, inj], players: { ...w.players, [p.id]: { ...p, status: { ...p.status, injuryId: inj.id } } } };
    if (p.clubId === w.userClubId) w = addInbox(w, { kind: 'injury', title: `${p.name} 훈련 중 부상`, body: `${p.name} 선수가 훈련 중 다쳐 약 ${days}일 결장합니다. 훈련 강도가 높을수록 부상 위험이 커집니다.` });
  }
  return w;
}

/** 모든 경기가 끝났으면 시즌 종료 처리 (우승 기록 부여). 멱등. */
export function checkSeasonEnd(world: WorldState): WorldState {
  if (world.season.status === 'finished') return world;
  if (world.fixtures.some((f) => f.status !== 'played')) return world;
  const names = Object.fromEntries(Object.values(world.clubs).map((c) => [c.id, c.name]));
  const table = computeStandings(world.season.clubIds, world.fixtures, world.competition.format, names);
  const champion = table[0]?.clubId;
  const players = { ...world.players };
  if (champion) {
    for (const p of Object.values(players)) {
      if (p.clubId === champion) {
        players[p.id] = {
          ...p,
          honours: [...p.honours, { id: `${world.season.id}-champion`, title: `${world.competition.shortName} 우승`, seasonLabel: world.season.label, origin: 'game' }],
        };
      }
    }
  }
  const userWon = champion === world.userClubId;
  let w: WorldState = {
    ...world,
    players,
    season: { ...world.season, status: 'finished' },
    manager: userWon ? { ...world.manager, record: { ...world.manager.record, trophies: world.manager.record.trophies + 1 } } : world.manager,
  };
  table.forEach((r, i) => {
    w = recordTx(w, { date: w.clock.gameDate, clubId: r.clubId, category: 'prize', amount: prizeMoney(i + 1), note: `${world.season.label} ${i + 1}위 상금` });
  });
  const userRank = table.findIndex((r) => r.clubId === world.userClubId) + 1;
  w = addInbox(w, {
    kind: 'season',
    title: `${world.season.label} 종료`,
    body: `우승: ${world.clubs[champion!]?.name ?? '-'} · 우리 팀 최종 순위: ${userRank}위. 다음 시즌 진행은 이후 업데이트(PHASE 3)에서 지원됩니다.`,
  });
  return w;
}

// ───────────────────────── 조회 헬퍼 ─────────────────────────

export function careerStats(world: WorldState, playerId: string): PlayerCareerStats {
  const seasons = Object.values(world.seasonStats).filter((s) => s.playerId === playerId);
  const appearances = seasons.reduce((a, s) => a + s.appearances, 0);
  const ratingSum = seasons.reduce((a, s) => a + s.ratingSum, 0);
  const ratingCount = seasons.reduce((a, s) => a + s.ratingCount, 0);
  return {
    playerId,
    appearances,
    goals: seasons.reduce((a, s) => a + s.goals, 0),
    assists: seasons.reduce((a, s) => a + s.assists, 0),
    averageRating: ratingCount ? Math.round((ratingSum / ratingCount) * 100) / 100 : null,
    seasons,
    honours: world.players[playerId]?.honours ?? [],
  };
}

export function standingsOf(world: WorldState) {
  const names = Object.fromEntries(Object.values(world.clubs).map((c) => [c.id, c.name]));
  return computeStandings(world.season.clubIds, world.fixtures, world.competition.format, names);
}
