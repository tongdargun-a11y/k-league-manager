import { describe, expect, it } from 'vitest';
import { advanceDay, applyMatchResult, createNewWorld, fixtureFor, prepareMatch } from './world';
import { simulateToEnd } from './match/engine';
import { parseCsv, parseInput, validateAndBuild, CSV_TEMPLATE, normalizePosition } from './import/importPlayers';
import { TEST_CLUBS } from '../data';
import { canRelease, canSign, evaluateBid, evaluateContract, executeTransfer, marketValue, releasePlayer, acceptIncomingOffer, wageDemand } from './transfers/transfers';
import { trainPlayer, growthRate } from './training/training';
import { playerOvr } from './ratings/ovr';
import { weeklyWageBill } from './finance/finance';
import { FREE_AGENT, type WorldState } from '../types';
import { migrateSave } from '../repositories/migrations';

const opts = { clubs: TEST_CLUBS, fileName: 't.csv', today: '2026-11-03', seasonYear: 2026 };

function playSeason(w: WorldState, untilDate?: string): WorldState {
  let guard = 0;
  while (w.season.status !== 'finished' && guard++ < 400 && (!untilDate || w.clock.gameDate < untilDate)) {
    const r = advanceDay(w);
    w = r.world;
    if (r.stopReason === 'match-day') {
      const f = fixtureFor(w, w.clock.gameDate, w.userClubId)!;
      w = applyMatchResult(w, simulateToEnd(prepareMatch(w, f), w.players, { assistUser: true }));
    }
  }
  return w;
}

describe('CSV/JSON 가져오기', () => {
  it('따옴표·쉼표가 들어간 CSV를 파싱한다', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
  it('템플릿은 오류 없이 가져와지고 OVR이 반영된다', () => {
    const { records } = parseInput(CSV_TEMPLATE, 't.csv');
    const r = validateAndBuild(records, opts);
    expect(r.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(r.players).toHaveLength(2);
    expect(playerOvr(r.players[0])).toBe(72);
    expect(r.players[0].positions).toEqual(['ST', 'LW']);
    expect(r.players[0].externalCareer?.goals).toBe(35);
    expect(r.players[0].meta.sourceType).toBe('user-import');
    expect(r.players[0].attributesSource).toBe('estimated');
  });
  it('필수 필드 누락·중복 ID·없는 구단·잘못된 숫자를 행 단위로 알려준다', () => {
    const csv = 'id,name,clubId,position,ovr\n1,가,ulsan,ST,70\n1,나,ulsan,ST,70\n2,,ulsan,ST,70\n3,다,nowhere,ST,70\n4,라,seoul,XX,70\n5,마,seoul,CB,150';
    const r = validateAndBuild(parseInput(csv, 'x.csv').records, opts);
    const errs = r.issues.filter((i) => i.level === 'error');
    expect(r.players.map((p) => p.name)).toEqual(['가']);
    expect(errs.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
  });
  it('구단 이름·포지션 별칭을 표준화한다', () => {
    expect(normalizePosition('cf')).toBe('ST');
    expect(normalizePosition('CDM')).toBe('DM');
    expect(normalizePosition('골키퍼')).toBe('GK');
    const r = validateAndBuild(parseInput('[{"id":"a","name":"A","club":"울산","position":"FW","ovr":66}]', 'a.json').records, opts);
    expect(r.players[0].clubId).toBe('ulsan');
  });
  it('가져온 선수로 새 게임을 만들면 부족한 인원은 테스트 선수로 채운다', () => {
    const { players } = validateAndBuild(parseInput(CSV_TEMPLATE, 't.csv').records, opts);
    const w = createNewWorld({ managerName: 'T', clubId: 'ulsan', seed: 1, importedPlayers: players });
    const ulsan = Object.values(w.players).filter((p) => p.clubId === 'ulsan');
    expect(ulsan.length).toBeGreaterThanOrEqual(18);
    expect(ulsan.some((p) => p.id === 'imp-sample-001')).toBe(true);
    expect(new Set(ulsan.map((p) => p.shirtNumber)).size).toBe(ulsan.length);
    expect(w.userLineup.starters).toHaveLength(11);
  });
});

describe('재정', () => {
  it('시즌 동안 월 정산·입장 수입·상금이 장부에 기록되고 잔액이 맞는다', () => {
    const w0 = createNewWorld({ managerName: 'T', clubId: 'gwangju', seed: 9 });
    const w = playSeason(w0);
    const cats = new Set(w.finance.ledger.map((t) => t.category));
    for (const c of ['wages', 'sponsor', 'broadcast', 'operations', 'gate', 'prize']) expect(cats.has(c as never)).toBe(true);
    const sum = w.finance.ledger.reduce((a, t) => a + t.amount, 0);
    expect(w.clubs.gwangju.finances.balance).toBe(w0.clubs.gwangju.finances.balance + sum);
    // 모든 구단이 한 시즌 만에 파산하지 않는다 (밸런스)
    for (const c of Object.values(w.clubs)) expect(c.finances.balance).toBeGreaterThan(0);
  });
});

describe('이적·계약', () => {
  const w = createNewWorld({ managerName: 'T', clubId: 'seoul', seed: 2 });
  const target = Object.values(w.players).filter((p) => p.clubId === 'ulsan').sort((a, b) => playerOvr(b) - playerOvr(a))[0];

  it('시장 가치는 OVR이 높을수록, 젊을수록 크다', () => {
    const v = marketValue(target, w.clock.gameDate);
    const older = { ...target, birthDate: '1990-01-01' };
    expect(v).toBeGreaterThan(marketValue(older, w.clock.gameDate));
  });
  it('낮은 제안은 거절, 충분한 제안은 수락', () => {
    const v = marketValue(target, w.clock.gameDate);
    expect(evaluateBid(w, target.id, Math.round(v * 0.3)).kind).toBe('reject');
    expect(evaluateBid(w, target.id, v * 3).kind).toBe('accept');
  });
  it('선수는 요구 주급 미만이면 계약을 거절한다', () => {
    const d = wageDemand(target, w.clock.gameDate, w.clubs.seoul.reputation);
    expect(evaluateContract(w, target.id, Math.round(d * 0.5), 3, 'seoul').ok).toBe(false);
    expect(evaluateContract(w, target.id, d * 2, 3, 'seoul').ok).toBe(true);
  });
  it('이적 성사 시 소속·이적료·예산이 동시에 반영된다', () => {
    const fee = 10000;
    const w2 = executeTransfer(w, { playerId: target.id, toClubId: 'seoul', fee, wage: 1500, years: 3 });
    expect(w2.players[target.id].clubId).toBe('seoul');
    expect(w2.clubs.seoul.finances.balance).toBe(w.clubs.seoul.finances.balance - fee);
    expect(w2.clubs.ulsan.finances.balance).toBe(w.clubs.ulsan.finances.balance + fee);
    expect(w2.clubs.seoul.finances.transferBudget).toBe(w.clubs.seoul.finances.transferBudget - fee);
    expect(w2.transfers[0].fee).toBe(fee);
    expect(w2.players[target.id].contract.endDate).toBe('2028-12-31');
  });
  it('예산 초과·이적시장 외 영입은 막는다', () => {
    expect(canSign(w, target.id, w.clubs.seoul.finances.transferBudget + 1, 100).ok).toBe(false);
    const closed = { ...w, clock: { ...w.clock, gameDate: '2026-05-01' } };
    expect(canSign(closed, target.id, 100, 100).reason).toContain('이적시장');
  });
  it('방출하면 보상금을 내고 무소속이 되며 라인업에서 빠진다', () => {
    const starter = w.userLineup.starters.find((id) => w.players[id].positions[0] !== 'GK')!;
    expect(canRelease(w, starter).ok).toBe(true);
    const w2 = releasePlayer(w, starter);
    expect(w2.players[starter].clubId).toBe(FREE_AGENT);
    expect(w2.userLineup.starters).not.toContain(starter);
    expect(w2.clubs.seoul.finances.balance).toBeLessThan(w.clubs.seoul.finances.balance);
  });
  it('받은 제안을 수락하면 선수가 떠나고 이적료가 들어온다', () => {
    const mine = Object.values(w.players).find((p) => p.clubId === 'seoul')!;
    const w1: WorldState = { ...w, incomingOffers: [{ id: 'o1', playerId: mine.id, fromClubId: 'jeonbuk', fee: 5000, date: w.clock.gameDate, expiresOn: '2026-03-01', status: 'pending' }] };
    const w2 = acceptIncomingOffer(w1, 'o1');
    expect(w2.players[mine.id].clubId).toBe('jeonbuk');
    expect(w2.clubs.seoul.finances.balance).toBe(w.clubs.seoul.finances.balance + 5000);
    expect(w2.incomingOffers[0].status).toBe('completed');
  });
  it('이적시장 중에는 AI 제안이 들어오고 7일 뒤 만료된다', () => {
    const w2 = playSeason(createNewWorld({ managerName: 'T', clubId: 'seoul', seed: 4 }), '2026-03-31');
    expect(w2.incomingOffers.length).toBeGreaterThan(0);
    expect(w2.incomingOffers.every((o) => o.status !== 'pending' || o.expiresOn >= w2.clock.gameDate)).toBe(true);
  });
});

describe('훈련·성장', () => {
  const w = createNewWorld({ managerName: 'T', clubId: 'daejeon', seed: 3 });
  const young = Object.values(w.players).find((p) => p.potential - playerOvr(p) >= 8)!;
  it('젊고 잠재력이 높은 선수는 성장 계수가 크고, 강도가 높을수록 커진다', () => {
    expect(growthRate(young, w.clock.gameDate, 'high', 270)).toBeGreaterThan(growthRate(young, w.clock.gameDate, 'low', 0));
    const vet = { ...young, birthDate: '1990-01-01' };
    expect(growthRate(vet, w.clock.gameDate, 'normal', 270)).toBe(0);
  });
  it('휴식 훈련은 능력치를 바꾸지 않는다', () => {
    expect(trainPlayer(young, { focus: 'rest', intensity: 'high' }, '2026-03-02', 270).entry).toBeNull();
  });
  it('한 시즌 동안 유망주 평균 OVR이 오른다', () => {
    const youngIds = Object.values(w.players).filter((p) => p.potential - playerOvr(p) >= 6).map((p) => p.id);
    const before = youngIds.reduce((a, id) => a + playerOvr(w.players[id]), 0) / youngIds.length;
    const end = playSeason(w);
    const after = youngIds.filter((id) => end.players[id]).reduce((a, id) => a + playerOvr(end.players[id]), 0) / youngIds.length;
    expect(after - before).toBeGreaterThan(1);
    expect(after - before).toBeLessThan(10);
    expect(end.trainingReports.length).toBeGreaterThan(0);
  });
});

describe('세이브 마이그레이션', () => {
  it('v1 세이브를 최신 버전으로 변환한다', () => {
    const w = createNewWorld({ managerName: 'T', clubId: 'daegu', seed: 1 });
    const { finance: _f, transfers: _t, incomingOffers: _o, training: _tr, trainingReports: _r, ...v1world } = w;
    void _f; void _t; void _o; void _tr; void _r;
    const v1 = { id: 's', schemaVersion: 1, name: 'n', createdAt: '', updatedAt: '', gameDate: w.clock.gameDate, managerName: 'T', selectedClubId: 'daegu',
      world: { ...v1world, seasonStats: { 'kleague1-2026:daegu-p01': { playerId: 'daegu-p01', seasonId: 'kleague1-2026', clubId: 'daegu', appearances: 1, starts: 1, minutes: 90, goals: 1, assists: 0, yellowCards: 0, redCards: 0, ratingSum: 7, ratingCount: 1, cleanSheets: 0 } } } } as never;
    const v2 = migrateSave(v1);
    expect(v2.schemaVersion).toBe(3);
    expect(v2.world.history).toEqual([]);
    expect(v2.world.finance.ledger).toEqual([]);
    expect(v2.world.training.daegu.focus).toBe('balanced');
    expect(Object.keys(v2.world.seasonStats)).toEqual(['kleague1-2026:daegu-p01:daegu']);
    expect(v2.world.competition.format.transferWindows.length).toBe(2);
  });
});

describe('주급', () => {
  it('주급 총액은 예산 안에서 시작한다', () => {
    const w = createNewWorld({ managerName: 'T', clubId: 'anyang', seed: 1 });
    for (const c of Object.values(w.clubs)) expect(weeklyWageBill(c.id, w.players)).toBeLessThanOrEqual(c.finances.wageBudget);
  });
});
