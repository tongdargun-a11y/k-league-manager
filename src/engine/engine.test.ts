import { describe, expect, it } from 'vitest';
import { computeStandings } from './league/standings';
import { generateRoundRobin } from './calendar/schedule';
import { ovrForPosition, positionFit } from './ratings/ovr';
import { advanceDay, applyMatchResult, createNewWorld, fixtureFor, prepareMatch, careerStats, standingsOf } from './world';
import { canSubstitute, changeTactic, simulateToEnd, stepMinute, substitute } from './match/engine';
import { TEST_FORMAT } from '../data';
import type { Fixture } from '../types';

const fx = (id: string, h: string, a: string, hg: number, ag: number): Fixture => ({
  id, seasonId: 's', competitionId: 'c', round: 1, date: '2026-03-01', homeClubId: h, awayClubId: a,
  status: 'played', result: { homeGoals: hg, awayGoals: ag }, seed: 1,
});

describe('승점·순위 계산', () => {
  it('승 3, 무 1, 패 0', () => {
    const t = computeStandings(['A', 'B', 'C'], [fx('1', 'A', 'B', 2, 0), fx('2', 'B', 'C', 1, 1)], TEST_FORMAT);
    const by = Object.fromEntries(t.map((r) => [r.clubId, r]));
    expect(by.A.points).toBe(3);
    expect(by.B.points).toBe(1);
    expect(by.C.points).toBe(1);
    expect(by.B.goalDifference).toBe(-2);
    expect(t[0].clubId).toBe('A');
  });
  it('동률 시 설정된 규칙(다득점 → 골득실) 순서로 정렬', () => {
    // A: 3-2 승, 0-1 패 → 3점, 득 3 실 3 / B: 1-0 승, 0-2 패 → 3점, 득 1 실 2
    const t = computeStandings(['A', 'B', 'X', 'Y'], [fx('1', 'A', 'X', 3, 2), fx('2', 'Y', 'A', 1, 0), fx('3', 'B', 'X', 1, 0), fx('4', 'Y', 'B', 2, 0)], TEST_FORMAT);
    const order = t.map((r) => r.clubId);
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
  });
  it('미진행 경기는 무시', () => {
    const f = { ...fx('1', 'A', 'B', 5, 0), status: 'scheduled' as const };
    const t = computeStandings(['A', 'B'], [f], TEST_FORMAT);
    expect(t.every((r) => r.points === 0 && r.played === 0)).toBe(true);
  });
});

describe('일정 생성', () => {
  it('12팀 3회전 = 33라운드, 팀당 33경기, 라운드마다 한 팀은 한 경기', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `T${i}`);
    const games = generateRoundRobin(ids, 3);
    expect(Math.max(...games.map((g) => g.round))).toBe(33);
    for (const id of ids) expect(games.filter((g) => g.home === id || g.away === id).length).toBe(33);
    for (let r = 1; r <= 33; r++) {
      const teams = games.filter((g) => g.round === r).flatMap((g) => [g.home, g.away]);
      expect(new Set(teams).size).toBe(12);
    }
  });
});

describe('OVR·포지션 적합도', () => {
  const world = createNewWorld({ managerName: 'T', clubId: 'stormhaven', seed: 1 });
  const gk = Object.values(world.players).find((p) => p.positions[0] === 'GK')!;
  const st = Object.values(world.players).find((p) => p.positions[0] === 'ST')!;
  it('골키퍼는 GK OVR이 ST OVR보다 높다', () => {
    expect(ovrForPosition(gk.attributes, 'GK')).toBeGreaterThan(ovrForPosition(gk.attributes, 'ST'));
  });
  it('주 포지션 적합도 1, 골키퍼 슬롯의 공격수는 매우 낮음', () => {
    expect(positionFit(st, 'ST')).toBe(1);
    expect(positionFit(st, 'GK')).toBeLessThan(0.5);
  });
});

describe('날짜 진행', () => {
  it('하루씩 진행되고, 사용자 경기일에 멈추며, 경기 전에는 더 진행되지 않는다', () => {
    let w = createNewWorld({ managerName: 'T', clubId: 'lumina', seed: 7 });
    let guard = 0;
    let r = advanceDay(w);
    while (r.stopReason !== 'match-day' && guard++ < 30) {
      w = r.world;
      r = advanceDay(w);
    }
    w = r.world;
    expect(r.stopReason).toBe('match-day');
    const f = fixtureFor(w, w.clock.gameDate, 'lumina');
    expect(f?.status).toBe('scheduled');
    const again = advanceDay(w);
    expect(again.advanced).toBe(false);
    expect(again.world.clock.gameDate).toBe(w.clock.gameDate);
  });
});

describe('경기 엔진', () => {
  const world = createNewWorld({ managerName: 'T', clubId: 'silvercrest', seed: 3 });
  const fixture = world.fixtures.find((f) => f.homeClubId === 'silvercrest' || f.awayClubId === 'silvercrest')!;

  it('같은 시드면 같은 결과 (재현성)', () => {
    const a = simulateToEnd(prepareMatch(world, fixture), world.players);
    const b = simulateToEnd(prepareMatch(world, fixture), world.players);
    expect(a.score).toEqual(b.score);
    expect(a.events.length).toBe(b.events.length);
  });

  it('리그 전체 평균 득점이 현실적인 범위 (경기당 1.6~3.8골)', () => {
    let goals = 0;
    let shots = 0;
    const sample = world.fixtures.slice(0, 66);
    for (const f of sample) {
      const s = simulateToEnd(prepareMatch(world, f), world.players);
      goals += s.score.home + s.score.away;
      shots += s.stats.home.shots + s.stats.away.shots;
    }
    const avg = goals / sample.length;
    expect(avg).toBeGreaterThan(1.6);
    expect(avg).toBeLessThan(3.8);
    expect(shots / sample.length).toBeGreaterThan(12);
  });

  it('교체가 반영되고 횟수 제한이 지켜진다', () => {
    let s = prepareMatch(world, fixture);
    const side = s.home.clubId === 'silvercrest' ? 'home' : 'away';
    s = stepMinute(s, world.players); // 킥오프
    for (let i = 0; i < 10; i++) s = stepMinute(s, world.players);
    const outId = s[side].slots.find((x) => x.position !== 'GK' && x.playerId)!.playerId!;
    const inId = s[side].bench.find((id) => world.players[id].positions[0] !== 'GK')!;
    s = substitute(s, side, outId, inId, world.players);
    expect(s[side].slots.some((x) => x.playerId === inId)).toBe(true);
    expect(s[side].slots.some((x) => x.playerId === outId)).toBe(false);
    expect(s[side].subsUsed).toBe(1);
    expect(canSubstitute(s, side, inId, outId).ok).toBe(false); // 나간 선수는 벤치에 없음
  });

  it('전술 변경(포메이션)이 반영된다', () => {
    let s = prepareMatch(world, fixture);
    const side = s.home.clubId === 'silvercrest' ? 'home' : 'away';
    s = changeTactic(s, side, { ...s[side].tactic, formation: '3-5-2', mentality: 'attacking' }, world.players);
    expect(s[side].tactic.formation).toBe('3-5-2');
    expect(s[side].slots.filter((x) => x.position === 'CB').length).toBe(3);
    expect(s[side].slots.filter((x) => x.playerId).length).toBe(11);
  });

  it('공격적 전술이 수비적 전술보다 슈팅이 많다 (통계적으로)', () => {
    let atkShots = 0;
    let defShots = 0;
    for (const f of world.fixtures.slice(0, 40)) {
      const base = prepareMatch(world, f);
      const a = structuredClone(base);
      a.home.tactic.mentality = 'attacking';
      const d = structuredClone(base);
      d.home.tactic.mentality = 'defensive';
      atkShots += simulateToEnd(a, world.players).stats.home.shots;
      defShots += simulateToEnd(d, world.players).stats.home.shots;
    }
    expect(atkShots).toBeGreaterThan(defShots);
  });
});

describe('경기 결과 반영', () => {
  it('득점이 선수·구단·순위에 동기화되고, 두 번 반영해도 한 번만 반영된다', () => {
    const world = createNewWorld({ managerName: 'T', clubId: 'granitebridge', seed: 11 });
    const fixture = world.fixtures.find((f) => f.homeClubId === 'granitebridge' || f.awayClubId === 'granitebridge')!;
    const state = simulateToEnd(prepareMatch(world, fixture), world.players, { assistUser: true });
    const w1 = applyMatchResult(world, state);
    const w2 = applyMatchResult(w1, state);
    expect(w2).toBe(w1);

    const f = w1.fixtures.find((x) => x.id === fixture.id)!;
    expect(f.status).toBe('played');
    expect(f.result).toEqual({ homeGoals: state.score.home, awayGoals: state.score.away });

    const homeGoalsByPlayers = Object.values(w1.seasonStats)
      .filter((s) => w1.players[s.playerId].clubId === fixture.homeClubId)
      .reduce((a, s) => a + s.goals, 0);
    expect(homeGoalsByPlayers).toBe(state.score.home);

    const table = standingsOf(w1);
    const homeRow = table.find((r) => r.clubId === fixture.homeClubId)!;
    expect(homeRow.goalsFor).toBe(state.score.home);
    expect(homeRow.played).toBe(1);

    const scorer = Object.values(w1.seasonStats).find((s) => s.goals > 0);
    if (scorer) expect(careerStats(w1, scorer.playerId).goals).toBe(scorer.goals);
    expect(w1.manager.record.played).toBe(1);
  });
});

describe('시즌 전체 진행', () => {
  it('날짜를 끝까지 진행하면 모든 팀이 33경기를 치르고 시즌이 종료된다', () => {
    let w = createNewWorld({ managerName: 'T', clubId: 'mossvale', seed: 5 });
    let guard = 0;
    while (w.season.status !== 'finished' && guard++ < 400) {
      const r = advanceDay(w);
      w = r.world;
      if (r.stopReason === 'match-day') {
        const f = fixtureFor(w, w.clock.gameDate, w.userClubId)!;
        w = applyMatchResult(w, simulateToEnd(prepareMatch(w, f), w.players, { assistUser: true }));
      }
    }
    expect(w.season.status).toBe('finished');
    const table = standingsOf(w);
    expect(table.every((r) => r.played === 33)).toBe(true);
    const totalPoints = table.reduce((a, r) => a + r.points, 0);
    const draws = w.fixtures.filter((f) => f.result!.homeGoals === f.result!.awayGoals).length;
    expect(totalPoints).toBe((w.fixtures.length - draws) * 3 + draws * 2);
    const champ = table[0].clubId;
    expect(Object.values(w.players).filter((p) => p.clubId === champ).every((p) => p.honours.length === 1)).toBe(true);
  });
});
