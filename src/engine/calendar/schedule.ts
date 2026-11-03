import type { CompetitionFormat, Fixture, GameDate } from '../../types';
import { addDays, weekday } from '../../utils/date';

/**
 * 라운드 로빈(서클 방식) 일정 생성.
 * cycles 번 반복하며 홀수 번째 사이클은 홈/원정을 뒤집는다.
 */
export function generateRoundRobin(clubIds: string[], cycles: number): { round: number; home: string; away: string }[] {
  const teams = [...clubIds];
  if (teams.length % 2 === 1) teams.push('__bye__');
  const n = teams.length;
  const roundsPerCycle = n - 1;
  const base: { home: string; away: string }[][] = [];
  const rot = [...teams];
  for (let r = 0; r < roundsPerCycle; r++) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rot[i];
      const b = rot[n - 1 - i];
      // 홈/원정 균형을 위해 라운드마다 교대
      pairs.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    base.push(pairs.filter((p) => p.home !== '__bye__' && p.away !== '__bye__'));
    // 첫 팀 고정, 나머지 회전
    rot.splice(1, 0, rot.pop()!);
  }
  const out: { round: number; home: string; away: string }[] = [];
  for (let c = 0; c < cycles; c++) {
    base.forEach((pairs, r) => {
      for (const p of pairs) {
        const flip = c % 2 === 1;
        out.push({ round: c * roundsPerCycle + r + 1, home: flip ? p.away : p.home, away: flip ? p.home : p.away });
      }
    });
  }
  return out;
}

/** 시즌 시작일 이후 첫 경기 요일부터 라운드 날짜를 배정한다. */
export function generateFixtures(params: {
  seasonId: string;
  competitionId: string;
  clubIds: string[];
  format: CompetitionFormat;
  startDate: GameDate;
}): Fixture[] {
  const { seasonId, competitionId, clubIds, format, startDate } = params;
  let first = addDays(startDate, 7); // 프리시즌 1주
  while (weekday(first) !== format.matchWeekday) first = addDays(first, 1);
  return generateRoundRobin(clubIds, format.roundRobinCycles).map((m, i) => ({
    id: `${seasonId}-r${String(m.round).padStart(2, '0')}-${i}`,
    seasonId,
    competitionId,
    round: m.round,
    date: addDays(first, (m.round - 1) * format.daysBetweenRounds),
    homeClubId: m.home,
    awayClubId: m.away,
    status: 'scheduled',
    result: null,
    seed: null,
  }));
}
