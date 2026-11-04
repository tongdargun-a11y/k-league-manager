import { Building2, HeartHandshake } from 'lucide-react';
import { useGame, useWorld } from '../../store/gameStore';
import { Panel, Stat } from '../../components/ui';
import { FACILITY_INFO, MAX_FACILITY, clubState, upgradeCost, upgradeFacility } from '../../engine/club/facilities';
import { formatMoney } from '../../engine/finance/finance';
import type { FacilityKind } from '../../types';

export function FacilitiesPage() {
  const world = useWorld();
  const mutate = useGame((s) => s.mutate);
  const toast = useGame((s) => s.toast);
  const st = clubState(world);
  if (!st) return null;
  const balance = world.clubs[world.userClubId].finances.balance;

  const upgrade = (k: FacilityKind) => {
    const r = upgradeFacility(world, k);
    if (!r.ok) return toast(r.reason ?? '업그레이드할 수 없습니다.', 'warn');
    mutate(() => r.world);
    void useGame.getState().saveGame({ silent: true });
    toast(`${FACILITY_INFO[k].label}을(를) ${st.facilities[k] + 1}레벨로 올렸습니다.`, 'success');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">구단 시설</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel><Stat label="구단 잔고" value={formatMoney(balance)} sub="시설 공사비는 잔고에서 바로 나갑니다" /></Panel>
        <Panel><Stat label="팬 만족도" value={<span className="flex items-center gap-2"><HeartHandshake size={20} className="text-rose-300" />{st.fanSatisfaction}</span>} sub="이기면 오르고 지면 내려갑니다. 홈 관중 수에 영향" /></Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(FACILITY_INFO) as FacilityKind[]).map((k) => {
          const lv = st.facilities[k];
          const max = lv >= MAX_FACILITY;
          return (
            <Panel key={k} title={<span className="flex items-center gap-2"><Building2 size={14} /> {FACILITY_INFO[k].label}</span>}>
              <div className="flex gap-1" aria-label={`${lv}레벨`}>
                {Array.from({ length: MAX_FACILITY }, (_, i) => <span key={i} className={`h-2.5 flex-1 rounded ${i < lv ? 'bg-gold-400' : 'bg-navy-700'}`} />)}
              </div>
              <p className="mt-2 text-sm text-slate-300">{lv}레벨 · {FACILITY_INFO[k].effect}</p>
              <button className="btn-gold mt-3 w-full" data-testid={`upgrade-${k}`} disabled={max || balance < upgradeCost(lv)} onClick={() => upgrade(k)}>
                {max ? '최고 레벨' : `${lv + 1}레벨 공사 (${formatMoney(upgradeCost(lv))})`}
              </button>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
