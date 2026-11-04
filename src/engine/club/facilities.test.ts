import { describe, expect, it } from 'vitest';
import { createNewWorld } from '../world';
import { applyFanResult, attendanceMult, clubState, defaultClubState, trainingMult, upgradeCost, upgradeFacility, youthBonus } from './facilities';
import { trainPlayer } from '../training/training';

const club = () => createNewWorld({ managerName: '가', clubId: 'stormhaven', mode: 'club' });

describe('PHASE 2 구단 시설·팬', () => {
  it('구단운영 모드에만 상태가 생기고 감독·구버전은 영향 없음', () => {
    expect(club().modeState).toEqual(defaultClubState());
    expect(clubState(createNewWorld({ managerName: '가', clubId: 'stormhaven', mode: 'manager' }))).toBeNull();
    expect(clubState(createNewWorld({ managerName: '가', clubId: 'stormhaven' }))).toBeNull();
    // PHASE 1에서 만든 구단운영 세이브(상태 없음)는 기본값으로 동작
    const w = club(); delete w.modeState;
    expect(clubState(w)).toEqual(defaultClubState());
  });
  it('업그레이드는 레벨을 올리고 잔고에서 비용을 뺀다', () => {
    const w = club();
    const before = w.clubs.stormhaven.finances.balance;
    const r = upgradeFacility(w, 'stadium');
    expect(r.ok).toBe(true);
    expect(clubState(r.world)!.facilities.stadium).toBe(3);
    expect(r.world.clubs.stormhaven.finances.balance).toBe(before - upgradeCost(2));
    expect(clubState(w)!.facilities.stadium).toBe(2); // 원본 불변
  });
  it('잔고 부족·최고 레벨이면 거절', () => {
    const w = club();
    w.clubs.stormhaven = { ...w.clubs.stormhaven, finances: { ...w.clubs.stormhaven.finances, balance: 0 } };
    expect(upgradeFacility(w, 'youth').ok).toBe(false);
    const m = club(); m.modeState = { ...clubState(m)!, facilities: { stadium: 5, training: 5, youth: 5 } };
    expect(upgradeFacility(m, 'training').ok).toBe(false);
  });
  it('효과: 기본 레벨은 1배, 레벨이 오르면 커진다', () => {
    const base = defaultClubState();
    expect(trainingMult(base)).toBeCloseTo(1);
    expect(youthBonus(base)).toBe(0);
    expect(attendanceMult(base)).toBeCloseTo(1, 1);
    const up = { ...base, facilities: { stadium: 5, training: 5, youth: 5 } };
    expect(attendanceMult(up)).toBeGreaterThan(attendanceMult(base));
    expect(trainingMult(up)).toBeGreaterThan(1);
    expect(youthBonus(up)).toBe(9);
  });
  it('훈련 배수 0이면 성장 없음 (배수가 실제로 적용됨)', () => {
    const w = club();
    const p = Object.values(w.players).find((x) => x.clubId === 'stormhaven')!;
    const r = trainPlayer(p, { intensity: 'normal', focus: 'balanced' } as never, w.clock.gameDate, 270, 0);
    expect(r.player.attributes).toEqual(p.attributes);
  });
  it('팬 만족도: 승 +3, 패 -3, 0~100', () => {
    const w = club();
    expect(clubState(applyFanResult(w, 2, 0))!.fanSatisfaction).toBe(63);
    expect(clubState(applyFanResult(w, 0, 1))!.fanSatisfaction).toBe(57);
    const mgr = createNewWorld({ managerName: '가', clubId: 'stormhaven', mode: 'manager' });
    expect(applyFanResult(mgr, 2, 0)).toBe(mgr);
  });
});
