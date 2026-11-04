import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, UserMinus, FileSignature } from 'lucide-react';
import { useGame, useWorld } from '../../store/gameStore';
import { boardRequestSigning, canRelease, canSign, evaluateBid, evaluateContract, executeTransfer, marketValue, releaseCost, releasePlayer, renewContract, wageDemand, type BidResponse } from '../../engine/transfers/transfers';
import { formatMoney } from '../../engine/finance/finance';
import { FOCUS_LABEL } from '../../engine/training/training';
import { Panel } from '../../components/ui';
import { FREE_AGENT, type Player, type TrainingFocus } from '../../types';
import { capsOf } from '../../engine/modes';

/** 다른 구단(또는 무소속) 선수: 영입 협상 */
export function NegotiationPanel({ player }: { player: Player }) {
  const world = useWorld();
  return capsOf(world).transferDirect ? <DirectNegotiation player={player} /> : <BoardRequestPanel player={player} />;
}

/** 감독 모드: 이사회에 영입 요청 */
function BoardRequestPanel({ player }: { player: Player }) {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const [msg, setMsg] = useState<string | null>(null);
  const today = world.clock.gameDate;
  const request = () => {
    const r = boardRequestSigning(world, player.id);
    setMsg(r.message);
    if (r.ok) { mutate(() => r.world); void useGame.getState().saveGame({ silent: true }); toast(r.message, 'success'); }
  };
  return (
    <Panel title={<span className="flex items-center gap-2"><Handshake size={14} /> 영입 요청</span>}>
      <p className="text-sm text-slate-300">감독은 직접 협상하지 않습니다. 이사회에 영입을 요청하면 예산과 규정을 보고 구단이 결정합니다.</p>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div><span className="text-xs text-slate-400">시장 가치(추정)</span><div className="font-bold">{player.clubId === FREE_AGENT ? '무소속 · 이적료 없음' : formatMoney(marketValue(player, today))}</div></div>
        <div><span className="text-xs text-slate-400">구단 이적 예산</span><div className="font-bold">{formatMoney(world.clubs[world.userClubId].finances.transferBudget)}</div></div>
      </div>
      <button className="btn-gold mt-3" data-testid="board-request" onClick={request}>이사회에 영입 요청</button>
      {msg && <p className="mt-2 text-sm text-gold-300">{msg}</p>}
    </Panel>
  );
}

function DirectNegotiation({ player }: { player: Player }) {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const navigate = useNavigate();
  const today = world.clock.gameDate;
  const isFree = player.clubId === FREE_AGENT;
  const value = marketValue(player, today);
  const demand = wageDemand(player, today, world.clubs[world.userClubId].reputation);
  const [fee, setFee] = useState(isFree ? 0 : value);
  const [response, setResponse] = useState<BidResponse | null>(isFree ? { kind: 'accept', fee: 0 } : null);
  const [wage, setWage] = useState(demand);
  const [years, setYears] = useState(2);
  const [contractMsg, setContractMsg] = useState<string | null>(null);
  const agreedFee = response?.kind === 'accept' ? response.fee : null;
  const check = canSign(world, player.id, agreedFee ?? fee, wage);

  const bid = () => {
    const r = evaluateBid(world, player.id, fee);
    setResponse(r);
    if (r.kind === 'counter') setFee(r.fee);
  };

  const sign = () => {
    const c = evaluateContract(world, player.id, wage, years, world.userClubId);
    if (!c.ok) { setContractMsg(c.message); if (c.demand) setWage(c.demand); return; }
    const chk = canSign(world, player.id, agreedFee ?? 0, wage);
    if (!chk.ok) { setContractMsg(chk.reason ?? '영입할 수 없습니다.'); return; }
    if (!window.confirm(`${player.name} 선수를 이적료 ${agreedFee ? formatMoney(agreedFee) : '없음'}, 주급 ${wage.toLocaleString()}만 원, ${years}년 계약으로 영입할까요?`)) return;
    mutate((w) => executeTransfer(w, { playerId: player.id, toClubId: w.userClubId, fee: agreedFee ?? 0, wage, years }));
    toast(`${player.name} 영입 완료! 전술 화면에서 라인업에 넣을 수 있습니다.`, 'success');
    navigate('/game/squad');
  };

  return (
    <Panel title={<span className="flex items-center gap-2"><Handshake size={14} /> 영입 협상</span>}>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div><span className="text-xs text-slate-400">시장 가치(추정)</span><div className="font-bold">{isFree ? '무소속 · 이적료 없음' : formatMoney(value)}</div></div>
        <div><span className="text-xs text-slate-400">예상 요구 주급</span><div className="font-bold">{demand.toLocaleString()}만 원</div></div>
        <div><span className="text-xs text-slate-400">우리 이적 예산</span><div className="font-bold">{formatMoney(world.clubs[world.userClubId].finances.transferBudget)}</div></div>
      </div>

      {!isFree && response?.kind !== 'accept' && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">1. 이적료 제안 (만원)
            <input type="number" className="input mt-1 w-36" step={100} min={0} value={fee} onChange={(e) => setFee(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <span className="pb-2 text-xs text-slate-400">= {formatMoney(fee)}</span>
          <button className="btn-gold" onClick={bid} disabled={!canSign(world, player.id, fee, 0).ok && canSign(world, player.id, fee, 0).reason !== '주급 예산을 넘습니다.'}>제안하기</button>
        </div>
      )}
      {!isFree && !canSign(world, player.id, fee, 0).ok && response?.kind !== 'accept' && <p className="mt-2 text-xs text-rose-300">{canSign(world, player.id, fee, 0).reason}</p>}
      {response && response.kind !== 'accept' && <p className={`mt-2 text-sm ${response.kind === 'counter' ? 'text-gold-300' : 'text-rose-300'}`}>{world.clubs[player.clubId]?.shortName}: {response.message}</p>}

      {response?.kind === 'accept' && (
        <div className="mt-3 space-y-2 border-t border-navy-700 pt-3">
          {!isFree && <p className="text-sm text-emerald-300">이적료 {formatMoney(response.fee)}에 구단 합의! 이제 선수와 개인 계약을 협상하세요.</p>}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">2. 주급 (만원)
              <input type="number" className="input mt-1 w-32" step={10} min={0} value={wage} onChange={(e) => setWage(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-xs text-slate-400">계약 기간
              <select className="input mt-1 w-24" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}년</option>)}</select>
            </label>
            <button className="btn-gold" onClick={sign}>계약 제안</button>
          </div>
          {contractMsg && <p className="text-sm text-gold-300">{player.name}: {contractMsg}</p>}
          {!check.ok && <p className="text-xs text-rose-300">{check.reason}</p>}
        </div>
      )}
    </Panel>
  );
}

/** 우리 팀 선수: 재계약·방출·개인 훈련 */
export function OwnPlayerPanel({ player }: { player: Player }) {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const navigate = useNavigate();
  const today = world.clock.gameDate;
  const demand = Math.max(player.contract.wage, wageDemand(player, today, world.clubs[world.userClubId].reputation));
  const [wage, setWage] = useState(demand);
  const [years, setYears] = useState(2);
  const [msg, setMsg] = useState<string | null>(null);
  const rel = canRelease(world, player.id);
  const cost = releaseCost(player, today);

  const renew = () => {
    const c = evaluateContract(world, player.id, wage, years, world.userClubId);
    if (!c.ok) { setMsg(c.message); if (c.demand) setWage(c.demand); return; }
    mutate((w) => renewContract(w, player.id, wage, years));
    setMsg(null);
    toast(`${player.name} 재계약 완료`, 'success');
  };

  return (
    <Panel title={<span className="flex items-center gap-2"><FileSignature size={14} /> 계약·훈련</span>}>
      <div className="space-y-4">
        {!capsOf(world).transferDirect && <p className="text-sm text-slate-400">현재 계약: ~{player.contract.endDate} · 주급 {player.contract.wage.toLocaleString()}만 원. 재계약과 방출은 구단 이사회가 결정합니다.</p>}
        {capsOf(world).transferDirect && <div>
          <div className="text-sm">현재 계약: ~{player.contract.endDate} · 주급 {player.contract.wage.toLocaleString()}만 원</div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">새 주급 (만원)
              <input type="number" className="input mt-1 w-32" step={10} value={wage} onChange={(e) => setWage(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <label className="text-xs text-slate-400">연장 기간
              <select className="input mt-1 w-24" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>+{y}년</option>)}</select>
            </label>
            <button className="btn-ghost" onClick={renew}>재계약 제안</button>
          </div>
          {msg && <p className="mt-1 text-sm text-gold-300">{player.name}: {msg}</p>}
        </div>}

        <div>
          <label className="text-xs text-slate-400">개인 훈련 집중
            <select className="input mt-1 w-40" value={player.trainingFocus ?? ''} onChange={(e) => {
              const v = (e.target.value || null) as TrainingFocus | null;
              mutate((w) => ({ ...w, players: { ...w.players, [player.id]: { ...w.players[player.id], trainingFocus: v } } }));
            }}>
              <option value="">팀 훈련 따르기</option>
              {(Object.keys(FOCUS_LABEL) as TrainingFocus[]).map((f) => <option key={f} value={f}>{FOCUS_LABEL[f]}</option>)}
            </select>
          </label>
        </div>

        {capsOf(world).transferDirect && <div className="border-t border-navy-700 pt-3">
          <button className="btn-ghost text-rose-300" disabled={!rel.ok} onClick={() => {
            if (!window.confirm(`${player.name} 선수를 방출할까요? 계약 해지 보상금 ${formatMoney(cost)}이 나가며 되돌릴 수 없습니다.`)) return;
            mutate((w) => releasePlayer(w, player.id));
            toast(`${player.name} 방출 완료`, 'info');
            navigate('/game/squad');
          }}><UserMinus size={16} /> 방출 (보상금 {formatMoney(cost)})</button>
          {!rel.ok && <p className="mt-1 text-xs text-slate-500">{rel.reason}</p>}
        </div>}
      </div>
    </Panel>
  );
}
