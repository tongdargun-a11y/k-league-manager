import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorld } from '../../store/gameStore';
import { CATEGORY_LABEL, INCOME_CATEGORIES, formatMoney, monthlySummaries, weeklyWageBill, monthlyFixedIncome, monthlyOperations } from '../../engine/finance/finance';
import { Panel, Stat } from '../../components/ui';
import { formatShort } from '../../utils/date';
import { playerOvr } from '../../engine/ratings/ovr';
import type { FinanceCategory } from '../../types';

export function FinancePage() {
  const world = useWorld();
  const club = world.clubs[world.userClubId];
  const squad = Object.values(world.players).filter((p) => p.clubId === club.id);
  const bill = weeklyWageBill(club.id, world.players);
  const months = useMemo(() => monthlySummaries(world.finance.ledger), [world.finance.ledger]);
  const fixed = monthlyFixedIncome(club);
  const estMonthly = fixed.broadcast + fixed.sponsor - Math.round(bill * 4.33) - monthlyOperations(club);
  const byYear = new Map<string, number>();
  for (const p of squad) byYear.set(p.contract.endDate.slice(0, 4), (byYear.get(p.contract.endDate.slice(0, 4)) ?? 0) + p.contract.wage);
  const years = [...byYear.entries()].sort();
  const cats = (Object.keys(CATEGORY_LABEL) as FinanceCategory[]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">재정</h1>
      <p className="text-xs text-slate-500">모든 금액은 게임 밸런스용 추정치이며 실제 구단 재정과 무관합니다.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel><Stat label="잔액" value={formatMoney(club.finances.balance)} /></Panel>
        <Panel><Stat label="이적 예산" value={formatMoney(club.finances.transferBudget)} sub="선수 판매 수익의 50%가 더해집니다" /></Panel>
        <Panel><Stat label="주급 총액 / 예산" value={`${formatMoney(bill)}`} sub={`예산 ${formatMoney(club.finances.wageBudget)} · 여유 ${formatMoney(club.finances.wageBudget - bill)}`} /></Panel>
        <Panel><Stat label="예상 월 고정 손익" value={<span className={estMonthly >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatMoney(estMonthly)}</span>} sub="입장 수입·이적·상금 제외" /></Panel>
      </div>

      <Panel title="월별 손익" className="overflow-x-auto">
        {months.length === 0 ? <p className="text-sm text-slate-400">아직 기록이 없습니다. 매월 1일 정산과 홈 경기 입장 수입이 기록됩니다.</p> : (
          <table className="table-base min-w-[720px]">
            <thead><tr><th>월</th>{cats.map((c) => <th key={c} className="text-right">{CATEGORY_LABEL[c]}</th>)}<th className="text-right">합계</th></tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="whitespace-nowrap">{m.month}</td>
                  {cats.map((c) => <td key={c} className={`text-right tabular-nums text-xs ${INCOME_CATEGORIES.includes(c) ? 'text-emerald-300/90' : 'text-rose-300/90'}`}>{m.byCategory[c] ? formatMoney(m.byCategory[c]!) : '-'}</td>)}
                  <td className={`text-right font-bold tabular-nums ${m.income + m.expense >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatMoney(m.income + m.expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="계약 만료 연도별 주급 부담">
          <ul className="space-y-1 text-sm">
            {years.map(([y, w]) => (
              <li key={y} className="flex justify-between"><span>{y}년 말 만료</span><span className="tabular-nums">{squad.filter((p) => p.contract.endDate.startsWith(y)).length}명 · 주급 {formatMoney(w)}</span></li>
            ))}
          </ul>
        </Panel>
        <Panel title="고액 주급 선수">
          <ul className="space-y-1 text-sm">
            {[...squad].sort((a, b) => b.contract.wage - a.contract.wage).slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Link to={`/game/player/${p.id}`} className="flex-1 truncate hover:text-gold-400">{p.name}</Link>
                <span className="text-xs text-slate-400">OVR {playerOvr(p)} · ~{p.contract.endDate.slice(0, 4)}</span>
                <span className="w-20 text-right tabular-nums">{formatMoney(p.contract.wage)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="최근 거래">
        {world.finance.ledger.length === 0 ? <p className="text-sm text-slate-400">기록 없음</p> : (
          <ul className="max-h-80 divide-y divide-navy-700 overflow-y-auto text-sm">
            {world.finance.ledger.slice(0, 60).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1.5">
                <span className="w-16 text-xs text-slate-400">{formatShort(t.date)}</span>
                <span className="w-24 text-xs text-slate-300">{CATEGORY_LABEL[t.category]}</span>
                <span className="flex-1 truncate text-xs text-slate-400">{t.note}</span>
                <span className={`w-20 text-right tabular-nums ${t.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatMoney(t.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
