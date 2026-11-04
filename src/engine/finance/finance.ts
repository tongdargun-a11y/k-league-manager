/**
 * 구단 재정 (게임용 단순 모델). 금액 단위는 모두 '만원'.
 * 실제 구단 재정과 무관한 밸런스용 추정치다.
 */
import type { Club, FinanceCategory, FinanceTx, GameDate, Player, WorldState } from '../../types';
import { FREE_AGENT } from '../../types';

export const CATEGORY_LABEL: Record<FinanceCategory, string> = {
  facility: '시설 투자',
  gate: '입장 수입',
  broadcast: '중계권',
  sponsor: '스폰서',
  prize: '상금',
  'transfer-in': '선수 판매',
  wages: '선수 급여',
  operations: '운영비',
  'transfer-out': '선수 영입',
  compensation: '계약 해지 보상금',
};

export const INCOME_CATEGORIES: FinanceCategory[] = ['gate', 'broadcast', 'sponsor', 'prize', 'transfer-in'];

/** 주급 합계 */
export function weeklyWageBill(clubId: string, players: Record<string, Player>): number {
  let sum = 0;
  for (const p of Object.values(players)) if (p.clubId === clubId) sum += p.contract.wage;
  return sum;
}

/** 월 고정 수입 (중계권 + 스폰서) */
export function monthlyFixedIncome(club: Club): { broadcast: number; sponsor: number } {
  return {
    broadcast: 26000,
    sponsor: Math.round((club.reputation ** 2) * 14),
  };
}

/** 월 운영비 */
export function monthlyOperations(club: Club): number {
  return Math.round(9000 + club.reputation * 120);
}

/** 홈 경기 관중 수 추정 (평판·순위 기반) */
export function estimateAttendance(club: Club, rank: number, clubCount: number): number {
  const base = 4000 + club.reputation * 140;
  const formBoost = 1 + (clubCount / 2 - rank) * 0.025;
  return Math.round(Math.max(2500, base * formBoost));
}

export const TICKET_PRICE = 1.5; // 만원

/** 시즌 상금 (순위별) */
export function prizeMoney(rank: number): number {
  const table = [50000, 30000, 20000, 15000, 12000, 10000, 8000, 7000, 6000, 5000, 4000, 3000];
  return table[rank - 1] ?? 2000;
}

let txSeq = 0;

/** 거래 기록 + 잔액 반영. 사용자 구단만 장부에 남기고(용량 관리), 모든 구단 잔액은 갱신한다. */
export function recordTx(world: WorldState, tx: Omit<FinanceTx, 'id'>): WorldState {
  if (tx.clubId === FREE_AGENT) return world;
  const club = world.clubs[tx.clubId];
  if (!club) return world;
  const isTransfer = tx.category === 'transfer-in' || tx.category === 'transfer-out';
  const nextClub: Club = {
    ...club,
    finances: {
      ...club.finances,
      balance: club.finances.balance + tx.amount,
      transferBudget: isTransfer ? Math.max(0, club.finances.transferBudget + tx.amount * (tx.amount > 0 ? 0.5 : 1)) : club.finances.transferBudget,
    },
  };
  const ledger = tx.clubId === world.userClubId
    ? [{ ...tx, id: `tx-${tx.date}-${++txSeq}-${world.finance.ledger.length}` }, ...world.finance.ledger].slice(0, 1500)
    : world.finance.ledger;
  return { ...world, clubs: { ...world.clubs, [tx.clubId]: nextClub }, finance: { ledger } };
}

/** 매월 1일 정산: 급여·운영비 지출, 중계권·스폰서 수입 (모든 구단) */
export function processMonthly(world: WorldState, date: GameDate): WorldState {
  let w = world;
  for (const club of Object.values(world.clubs)) {
    const wages = Math.round(weeklyWageBill(club.id, w.players) * 4.33);
    const fixed = monthlyFixedIncome(club);
    w = recordTx(w, { date, clubId: club.id, category: 'broadcast', amount: fixed.broadcast, note: '월 중계권 배분금' });
    w = recordTx(w, { date, clubId: club.id, category: 'sponsor', amount: fixed.sponsor, note: '월 스폰서 수입' });
    w = recordTx(w, { date, clubId: club.id, category: 'wages', amount: -wages, note: '월 선수 급여' });
    w = recordTx(w, { date, clubId: club.id, category: 'operations', amount: -monthlyOperations(club), note: '월 운영비' });
  }
  return w;
}

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  byCategory: Partial<Record<FinanceCategory, number>>;
}

export function monthlySummaries(ledger: FinanceTx[]): MonthSummary[] {
  const map = new Map<string, MonthSummary>();
  for (const tx of ledger) {
    const month = tx.date.slice(0, 7);
    const m = map.get(month) ?? { month, income: 0, expense: 0, byCategory: {} };
    if (tx.amount >= 0) m.income += tx.amount;
    else m.expense += tx.amount;
    m.byCategory[tx.category] = (m.byCategory[tx.category] ?? 0) + tx.amount;
    map.set(month, m);
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
}

/** 만원 → '12.3억' / '4,500만' 표기 */
export function formatMoney(manwon: number): string {
  const sign = manwon < 0 ? '-' : '';
  const v = Math.abs(manwon);
  if (v >= 10000) return `${sign}${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}억`;
  return `${sign}${Math.round(v).toLocaleString('ko-KR')}만`;
}
