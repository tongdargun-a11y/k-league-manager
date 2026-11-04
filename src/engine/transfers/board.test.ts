import { describe, expect, it } from 'vitest';
import { createNewWorld } from '../world';
import { boardRequestSigning, marketValue, processTransferDay } from './transfers';
import { capsOf } from '../modes';
import { FREE_AGENT } from '../../types';

const mgr = () => {
  const w = createNewWorld({ managerName: '가', clubId: 'stormhaven', mode: 'manager' });
  return { ...w, clock: { ...w.clock, gameDate: '2026-02-20' } }; // 겨울 이적시장
};

describe('PHASE 2-3 감독 모드 영입 요청', () => {
  it('감독은 직접 영입 불가, 구단운영·구버전은 가능', () => {
    expect(capsOf({ mode: 'manager' }).transferDirect).toBe(false);
    expect(capsOf({ mode: 'club' }).transferDirect).toBe(true);
    expect(capsOf({}).transferDirect).toBe(true);
  });
  it('저렴한 선수는 이사회가 승인하고 이적이 처리된다', () => {
    const w = mgr();
    const today = w.clock.gameDate;
    const target = Object.values(w.players)
      .filter((p) => p.clubId !== 'stormhaven' && p.clubId !== FREE_AGENT && p.positions[0] !== 'GK')
      .sort((a, b) => marketValue(a, today) - marketValue(b, today))[0];
    const r = boardRequestSigning(w, target.id);
    expect(r.ok, r.message).toBe(true);
    expect(r.world.players[target.id].clubId).toBe('stormhaven');
    expect(r.world.inbox[0].title).toContain('영입 승인');
    expect(w.players[target.id].clubId).not.toBe('stormhaven'); // 원본 불변
  });
  it('예산을 넘는 선수는 거절되고 세계는 그대로', () => {
    const w = mgr();
    w.clubs.stormhaven = { ...w.clubs.stormhaven, finances: { ...w.clubs.stormhaven.finances, transferBudget: 0 } };
    const target = Object.values(w.players).find((p) => p.clubId === 'lumina')!;
    const r = boardRequestSigning(w, target.id);
    expect(r.ok).toBe(false);
    expect(r.world).toBe(w);
  });
  it('감독 모드에서 받은 제안은 대기 상태로 남지 않는다 (이사회가 즉시 결정)', () => {
    let w = mgr();
    for (let d = 0; d < 40; d++) {
      const date = `2026-03-${String((d % 28) + 1).padStart(2, '0')}`;
      w = processTransferDay({ ...w, worldSeed: d }, date);
    }
    expect(w.incomingOffers.length).toBeGreaterThan(0);
    expect(w.incomingOffers.some((o) => o.status === 'pending')).toBe(false);
  });
});
