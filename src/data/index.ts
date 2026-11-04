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

/** 재정 등급 배수 (초기 잔고·이적 예산에 적용) */
export const FINANCE_TIER_MULT: Record<NonNullable<Club['financeTier']>, number> = { S: 1.6, A: 1.3, B: 1.0, C: 0.8, D: 0.6 };
export const financeMult = (c: Pick<Club, 'financeTier'>) => (c.financeTier ? FINANCE_TIER_MULT[c.financeTier] : 1);

export type SeasonLength = 'long' | 'short';
/** 시즌 길이별 대회 규칙. short = 2회전 22라운드 */
export function competitionFor(length: SeasonLength = 'long'): Competition {
  if (length === 'long') return TEST_COMPETITION;
  return {
    ...TEST_COMPETITION,
    format: { ...TEST_FORMAT, roundRobinCycles: 2, description: '솔레아 프리미어 디비전 (짧은 시즌): 12팀 2회전(22라운드) 리그. 이적시장 기간·외국인 수 등은 게임 설정값입니다.' },
  };
}

/** 가상 국가. 자국 = 솔레아. 구버전 세이브의 '대한민국'도 자국으로 취급한다(세이브는 바꾸지 않음). */
export const HOME_NATION = '솔레아';
export const LEGACY_HOME_NATIONS = ['대한민국'];
export const isHomeNation = (n: string) => n === HOME_NATION || LEGACY_HOME_NATIONS.includes(n);

export const DEFAULT_SEASON_YEAR = 2026;
export const DEFAULT_START_DATE = '2026-02-16';
