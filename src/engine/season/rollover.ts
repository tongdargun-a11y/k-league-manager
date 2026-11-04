import type { Club, Fixture, Player, PlayerAttributes, Position, SeasonRecord, WorldState } from '../../types';
import { RETIRED } from '../../types';
import { generateFixtures } from '../calendar/schedule';
import { computeStandings } from '../league/standings';
import { pickBestLineup } from '../match/lineup';
import { addInbox } from '../inbox';
import { clamp, ovrForPosition, playerOvr } from '../ratings/ovr';
import { ageOn } from '../../utils/date';
import { createRng, hashString, type Rng } from '../../utils/rng';
import { koreanName, makeAttributes, tuneToOvr } from '../../data/testPlayers';
import { HOME_NATION } from '../../data';

const PHYSICAL: (keyof PlayerAttributes)[] = ['pace', 'acceleration', 'stamina', 'strength', 'jumping'];
const YOUTH_POSITIONS: Position[][] = [['ST'], ['CM', 'DM'], ['CB'], ['LW', 'LM'], ['RB', 'CB'], ['GK'], ['AM', 'CM'], ['RW', 'RM']];
/** AI 구단이 시즌 시작 때 맞추는 최소 인원 */
const AI_MIN_SQUAD = 22;

/** 시즌 결산 기록을 만든다 (순위표 요약·득점왕·도움왕). */
export function buildSeasonRecord(world: WorldState): SeasonRecord {
  const names = Object.fromEntries(Object.values(world.clubs).map((c) => [c.id, c.name]));
  const table = computeStandings(world.season.clubIds, world.fixtures.filter((f) => f.seasonId === world.season.id), world.competition.format, names);
  const stats = Object.values(world.seasonStats).filter((s) => s.seasonId === world.season.id);
  const leader = (key: 'goals' | 'assists') => {
    const totals = new Map<string, number>();
    for (const s of stats) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s[key]);
    const best = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best || best[1] === 0) return null;
    const p = world.players[best[0]];
    return { playerId: best[0], name: p?.name ?? best[0], clubId: p?.clubId ?? '', value: best[1] };
  };
  return {
    seasonId: world.season.id,
    label: world.season.label,
    championId: table[0]?.clubId ?? '',
    userClubId: world.userClubId,
    userRank: table.findIndex((r) => r.clubId === world.userClubId) + 1,
    table: table.map((r, i) => ({ clubId: r.clubId, rank: i + 1, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points })),
    topScorer: leader('goals'),
    topAssister: leader('assists'),
  };
}

/** 나이에 따른 연간 능력치 하락 (31세 이상). 순수 함수. */
export function agePlayer(p: Player, rng: Rng, on: string): Player {
  const age = ageOn(p.birthDate, on);
  if (age < 31) return p;
  const base = age >= 35 ? 3 : age >= 33 ? 2 : 1;
  const attributes = { ...p.attributes };
  for (const k of Object.keys(attributes) as (keyof PlayerAttributes)[]) {
    const drop = (PHYSICAL.includes(k) ? base + 1 : base * 0.5) * (0.5 + rng.next());
    attributes[k] = clamp(Math.round(attributes[k] - drop), 10, 99);
  }
  const aged = { ...p, attributes };
  return { ...aged, potential: Math.max(playerOvr(aged), Math.min(p.potential, playerOvr(aged) + 2)) };
}

/** 은퇴 확률 (시즌 종료 시 1회 판정) */
export function retireChance(p: Player, on: string): number {
  const age = ageOn(p.birthDate, on);
  if (age < 33) return 0;
  const ovr = playerOvr(p);
  const base = age >= 38 ? 0.95 : age >= 36 ? 0.6 : age >= 35 ? 0.4 : age >= 34 ? 0.2 : 0.08;
  return clamp(base + (ovr < 55 ? 0.2 : 0) - (ovr > 70 ? 0.15 : 0), 0, 1);
}

function makeYouth(club: Club, rng: Rng, idx: number, year: number, usedNumbers: Set<number>): Player {
  const positions = YOUTH_POSITIONS[idx % YOUTH_POSITIONS.length];
  const pos = positions[0];
  const age = rng.int(17, 19);
  const target = clamp(Math.round(42 + (club.reputation - 65) * 0.3 + rng.int(0, 8)), 38, 60);
  const attributes = tuneToOvr(makeAttributes(rng, pos, target), pos, target);
  const ovr = ovrForPosition(attributes, pos);
  let shirt = 40;
  while (usedNumbers.has(shirt)) shirt++;
  usedNumbers.add(shirt);
  const today = `${year}-01-01`;
  return {
    id: `${club.id}-y${year}-${idx + 1}`,
    name: koreanName(rng),
    nationality: HOME_NATION,
    birthDate: `${year - age}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    heightCm: pos === 'GK' || pos === 'CB' ? rng.int(182, 192) : rng.int(168, 185),
    weightKg: rng.int(60, 80),
    positions,
    foot: pos.startsWith('L') ? 'left' : rng.chance(0.2) ? 'left' : 'right',
    shirtNumber: shirt,
    clubId: club.id,
    contract: { startDate: today, endDate: `${year + 2}-12-31`, wage: 30 + rng.int(0, 30) },
    attributes,
    potential: clamp(ovr + rng.int(10, 30), ovr, 90),
    peakOvr: ovr,
    photoAssetId: null,
    status: { fitness: 100, condition: 70, morale: 75, sharpness: 50, injuryId: null, yellowCards: 0, suspendedMatches: 0 },
    externalCareer: null,
    honours: [],
    meta: { sourceType: 'test', source: 'generated:youth-intake', sourceUpdatedAt: today, licenseStatus: 'none', createdAt: today, updatedAt: today },
  };
}

/**
 * 끝난 시즌을 결산하고 다음 시즌을 시작한다. 순수 함수.
 * 결산 기록 저장 → 노화·은퇴 → 유소년 입단 → 새 일정 생성. 승강제는 2부 리그 데이터가 없어 아직 적용하지 않는다.
 */
export function startNextSeason(world: WorldState): WorldState {
  if (world.season.status !== 'finished') throw new Error('시즌이 아직 끝나지 않았습니다.');
  const record = buildSeasonRecord(world);
  const year = Number(world.season.id.split('-').pop()) + 1;
  const seasonId = `${world.competition.id}-${year}`;
  const rng = createRng(hashString(`${world.worldSeed}:rollover:${year}`));
  const on = `${year - 1}-12-31`;

  // 노화·은퇴
  const players: Record<string, Player> = {};
  const retiredUser: string[] = [];
  let retiredCount = 0;
  for (const p of Object.values(world.players)) {
    if (p.clubId === RETIRED) { players[p.id] = p; continue; }
    const aged = agePlayer(p, rng, on);
    if (rng.chance(retireChance(aged, on))) {
      players[p.id] = { ...aged, clubId: RETIRED, contract: { ...aged.contract, wage: 0, endDate: on } };
      retiredCount++;
      if (p.clubId === world.userClubId) retiredUser.push(p.name);
    } else players[p.id] = aged;
  }

  // 유소년 입단: 모든 구단 2명 + AI 구단은 최소 인원까지
  const youthUser: string[] = [];
  for (const club of Object.values(world.clubs)) {
    const squad = Object.values(players).filter((p) => p.clubId === club.id);
    const used = new Set(squad.map((p) => p.shirtNumber));
    const isUser = club.id === world.userClubId;
    const n = Math.min(world.competition.format.maxSquadSize - squad.length, isUser ? 2 : Math.max(2, AI_MIN_SQUAD - squad.length));
    for (let i = 0; i < n; i++) {
      const y = makeYouth(club, rng, i, year, used);
      players[y.id] = y;
      if (isUser) youthUser.push(`${y.name}(${y.positions[0]})`);
    }
  }

  const startDate = `${year}-02-16`;
  const fixtures: Fixture[] = generateFixtures({ seasonId, competitionId: world.competition.id, clubIds: world.season.clubIds, format: world.competition.format, startDate })
    .map((f) => ({ ...f, seed: hashString(`${world.worldSeed}:${f.id}`) }));
  const endDate = fixtures.reduce((m, f) => (f.date > m ? f.date : m), startDate);

  let w: WorldState = {
    ...world,
    players,
    season: { ...world.season, id: seasonId, label: `${year} 시즌`, startDate, endDate, status: 'active' },
    fixtures,
    reports: {},
    history: [...(world.history ?? []), record],
    injuries: world.injuries.filter((i) => players[i.playerId]?.clubId !== RETIRED),
    userLineup: pickBestLineup(world.userClubId, players, world.tactics[world.userClubId].formation, world.competition.format.benchSize),
    incomingOffers: world.incomingOffers.filter((o) => o.status !== 'pending'),
  };
  w = addInbox(w, {
    kind: 'season',
    title: `${year} 시즌 준비 시작`,
    body: [
      `${record.label} 결산이 '순위' 화면의 역대 기록에 저장되었습니다. 개막은 ${fixtures[0]?.date ?? startDate}입니다.`,
      retiredUser.length ? `은퇴: ${retiredUser.join(', ')}` : '',
      youthUser.length ? `유소년 입단: ${youthUser.join(', ')}` : '',
      `리그 전체 은퇴 ${retiredCount}명. 승강제는 2부 리그 데이터가 준비되면 추가됩니다.`,
    ].filter(Boolean).join('\n'),
  });
  return w;
}

/** 표시용: 결산 기록의 구단 이름 */
export const recordClubName = (world: WorldState, id: string) => world.clubs[id]?.name ?? id;

