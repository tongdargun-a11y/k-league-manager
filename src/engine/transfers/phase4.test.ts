import { describe, expect, it } from 'vitest';
import { createNewWorld } from '../world';
import { aiToAiTransfer, canLoanOut, loanOut, processTransferDay, returnLoans } from './transfers';
import { createRng } from '../../utils/rng';

const base = () => {
  const w = createNewWorld({ managerName: '가', clubId: 'stormhaven' });
  return { ...w, clock: { ...w.clock, gameDate: '2026-02-20' } };
};

describe('PHASE 4 AI 이적·임대', () => {
  it('AI 구단끼리 이적이 일어나고 사용자 구단은 건드리지 않는다', () => {
    let w = base();
    const mine = Object.values(w.players).filter((p) => p.clubId === 'stormhaven').map((p) => p.id).sort();
    for (let i = 0; i < 60; i++) w = aiToAiTransfer(w, '2026-02-20', createRng(i));
    const moved = w.transfers.filter((t) => t.type === 'transfer');
    expect(moved.length).toBeGreaterThan(0);
    for (const t of moved) {
      expect(t.fromClubId).not.toBe('stormhaven');
      expect(t.toClubId).not.toBe('stormhaven');
    }
    expect(Object.values(w.players).filter((p) => p.clubId === 'stormhaven').map((p) => p.id).sort()).toEqual(mine);
    for (const c of Object.keys(w.clubs)) expect(Object.values(w.players).filter((p) => p.clubId === c).length).toBeGreaterThanOrEqual(w.competition.format.minSquadSize);
  });
  it('이적시장 밖에서는 AI 이적이 없다', () => {
    let w = base();
    for (let d = 1; d <= 28; d++) w = processTransferDay(w, `2026-05-${String(d).padStart(2, '0')}`);
    expect(w.transfers.filter((t) => t.type === 'transfer').length).toBe(0);
  });
  it('임대: 보내면 다른 구단 소속, 새 시즌 복귀', () => {
    const w = base();
    const p = Object.values(w.players).filter((x) => x.clubId === 'stormhaven' && x.positions[0] !== 'GK').slice(-1)[0];
    expect(canLoanOut(w, p.id).ok).toBe(true);
    const l = loanOut(w, p.id);
    expect(l.players[p.id].clubId).not.toBe('stormhaven');
    expect(l.players[p.id].loan?.parentClubId).toBe('stormhaven');
    expect(l.userLineup.starters).not.toContain(p.id);
    expect(canLoanOut(l, p.id).ok).toBe(false);
    const back = returnLoans(l);
    expect(back.players[p.id].clubId).toBe('stormhaven');
    expect(back.players[p.id].loan).toBeUndefined();
  });
  it('임대 중 선수는 AI 이적 대상이 아니다', () => {
    let w = base();
    const p = Object.values(w.players).filter((x) => x.clubId === 'stormhaven' && x.positions[0] !== 'GK').slice(-1)[0];
    w = loanOut(w, p.id);
    for (let i = 0; i < 60; i++) w = aiToAiTransfer(w, '2026-02-20', createRng(i));
    expect(w.transfers.some((t) => t.playerId === p.id && t.type === 'transfer')).toBe(false);
  });
});
