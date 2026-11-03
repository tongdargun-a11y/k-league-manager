import type { CompetitionFormat, Fixture } from '../../types';

export interface StandingRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** 최근 5경기 (오래된 것 → 최근) */
  form: ('W' | 'D' | 'L')[];
}

export function pointsFor(result: 'W' | 'D' | 'L', format: CompetitionFormat): number {
  return result === 'W' ? format.pointsForWin : result === 'D' ? format.pointsForDraw : format.pointsForLoss;
}

/** 순위 계산: 승점 → 설정된 동률 규칙 순서. 순수 함수. */
export function computeStandings(
  clubIds: string[],
  fixtures: Fixture[],
  format: CompetitionFormat,
  clubNames: Record<string, string> = {},
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of clubIds) {
    rows.set(id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: [] });
  }
  const played = fixtures
    .filter((f) => f.status === 'played' && f.result)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const f of played) {
    const h = rows.get(f.homeClubId);
    const a = rows.get(f.awayClubId);
    if (!h || !a || !f.result) continue;
    const { homeGoals, awayGoals } = f.result;
    const hr: 'W' | 'D' | 'L' = homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L';
    const ar: 'W' | 'D' | 'L' = hr === 'W' ? 'L' : hr === 'L' ? 'W' : 'D';
    apply(h, homeGoals, awayGoals, hr, format);
    apply(a, awayGoals, homeGoals, ar, format);
  }

  const list = [...rows.values()];
  list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    for (const rule of format.tiebreakers) {
      let d = 0;
      if (rule === 'goalDifference') d = y.goalDifference - x.goalDifference;
      else if (rule === 'goalsFor') d = y.goalsFor - x.goalsFor;
      else if (rule === 'wins') d = y.won - x.won;
      else if (rule === 'headToHead') d = headToHead(x.clubId, y.clubId, played, format);
      else if (rule === 'name') d = (clubNames[x.clubId] ?? x.clubId).localeCompare(clubNames[y.clubId] ?? y.clubId, 'ko');
      if (d !== 0) return d;
    }
    return 0;
  });
  return list;
}

function apply(row: StandingRow, gf: number, ga: number, r: 'W' | 'D' | 'L', format: CompetitionFormat) {
  row.played++;
  row.goalsFor += gf;
  row.goalsAgainst += ga;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (r === 'W') row.won++;
  else if (r === 'D') row.drawn++;
  else row.lost++;
  row.points += pointsFor(r, format);
  row.form = [...row.form, r].slice(-5);
}

/** 상대 전적 승점 차 (y - x 순서로 반환해 정렬에 사용) */
function headToHead(x: string, y: string, fixtures: Fixture[], format: CompetitionFormat): number {
  let px = 0;
  let py = 0;
  for (const f of fixtures) {
    if (!f.result) continue;
    const involved = (f.homeClubId === x && f.awayClubId === y) || (f.homeClubId === y && f.awayClubId === x);
    if (!involved) continue;
    const xHome = f.homeClubId === x;
    const xg = xHome ? f.result.homeGoals : f.result.awayGoals;
    const yg = xHome ? f.result.awayGoals : f.result.homeGoals;
    const xr = xg > yg ? 'W' : xg === yg ? 'D' : 'L';
    const yr = xr === 'W' ? 'L' : xr === 'L' ? 'W' : 'D';
    px += pointsFor(xr, format);
    py += pointsFor(yr, format);
  }
  return py - px;
}
