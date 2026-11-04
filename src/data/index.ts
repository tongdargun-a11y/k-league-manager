import clubsJson from './clubs.json';
import type { Club, Competition, CompetitionFormat } from '../types';

export const DATA_NOTICE = clubsJson._notice;

export const TEST_CLUBS: Club[] = clubsJson.clubs.map((c) => ({
  ...c,
  financeTier: c.financeTier as Club['financeTier'],
  crestAssetId: null,
  finances: {
    balance: Math.round(c.reputation * 18) * 100,
    transferBudget: Math.round(c.reputation * 4) * 100,
    wageBudget: Math.round(c.reputation * 1.2) * 100,
  },
  meta: {
    sourceType: 'test',
    source: 'src/data/clubs.json',
    sourceUpdatedAt: clubsJson.sourceUpdatedAt,
    licenseStatus: 'none',
    createdAt: clubsJson.sourceUpdatedAt,
    updatedAt: clubsJson.sourceUpdatedAt,
  },
}));

/** 대회 규칙은 설정 데이터로 둔다. 실제 시즌 규칙과 다를 수 있다(테스트용). */
export const TEST_FORMAT: CompetitionFormat = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  roundRobinCycles: 3,
  matchWeekday: 6,
  daysBetweenRounds: 7,
  tiebreakers: ['goalsFor', 'goalDifference', 'wins', 'name'],
  maxSubstitutions: 5,
  maxSubstitutionWindows: 3,
  benchSize: 9,
  yellowCardsForSuspension: 4,
  transferWindows: [
    { start: '01-01', end: '03-31', label: '겨울 이적시장' },
    { start: '07-01', end: '07-31', label: '여름 이적시장' },
  ],
  minSquadSize: 18,
  maxSquadSize: 32,
  maxForeignPlayers: 6,
  description: '솔레아 프리미어 디비전: 12팀 3회전(33라운드) 리그. 이적시장 기간·외국인 수 등은 게임 설정값입니다.',
};

export const TEST_COMPETITION: Competition = {
  id: 'spd',
  name: '솔레아 프리미어 디비전',
  shortName: '솔레아 리그',
  format: TEST_FORMAT,
};

export const DEFAULT_SEASON_YEAR = 2026;
export const DEFAULT_START_DATE = '2026-02-16';
