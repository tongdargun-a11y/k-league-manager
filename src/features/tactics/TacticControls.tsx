import type { Tactic } from '../../types';
import { FORMATION_LIST, TACTIC_LABELS, TACTIC_PRESETS } from '../../engine/tactics/formations';
import { Segmented } from '../../components/ui';

type Opt<K extends keyof typeof TACTIC_LABELS> = { value: keyof (typeof TACTIC_LABELS)[K] & string; label: string }[];
function opts<K extends keyof typeof TACTIC_LABELS>(k: K): Opt<K> {
  return Object.entries(TACTIC_LABELS[k]).map(([value, label]) => ({ value, label })) as Opt<K>;
}

/** 팀 전술 설정 (전술 화면·라이브 경기 공용) */
export function TacticControls({ tactic, onChange, showFormation = true }: { tactic: Tactic; onChange: (t: Tactic) => void; showFormation?: boolean }) {
  const set = <K extends keyof Tactic>(k: K, v: Tactic[K]) => onChange({ ...tactic, [k]: v });
  const row = (label: string, el: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-slate-300">{label}</span>
      {el}
    </div>
  );
  return (
    <div className="divide-y divide-navy-700/60">
      {showFormation && row('포메이션', (
        <select className="input w-auto" value={tactic.formation} onChange={(e) => set('formation', e.target.value as Tactic['formation'])} aria-label="포메이션">
          {FORMATION_LIST.map((f) => <option key={f}>{f}</option>)}
        </select>
      ))}
      {row('공격 성향', <Segmented size="sm" value={tactic.mentality} onChange={(v) => set('mentality', v)} options={opts('mentality')} />)}
      {row('압박 강도', <Segmented size="sm" value={tactic.pressing} onChange={(v) => set('pressing', v)} options={opts('pressing')} />)}
      {row('수비 라인', <Segmented size="sm" value={tactic.defensiveLine} onChange={(v) => set('defensiveLine', v)} options={opts('defensiveLine')} />)}
      {row('전개 속도', <Segmented size="sm" value={tactic.tempo} onChange={(v) => set('tempo', v)} options={opts('tempo')} />)}
      {row('패스', <Segmented size="sm" value={tactic.passing} onChange={(v) => set('passing', v)} options={opts('passing')} />)}
      {row('공격 방향', <Segmented size="sm" value={tactic.attackFocus} onChange={(v) => set('attackFocus', v)} options={opts('attackFocus')} />)}
      {row('역습', <Segmented size="sm" value={tactic.counterAttack ? 'on' : 'off'} onChange={(v) => set('counterAttack', v === 'on')} options={[{ value: 'on', label: '사용' }, { value: 'off', label: '미사용' }]} />)}
      {row('수비 전환', <Segmented size="sm" value={tactic.transition} onChange={(v) => set('transition', v)} options={opts('transition')} />)}
    </div>
  );
}

export function PresetPicker({ tactic, onChange }: { tactic: Tactic; onChange: (t: Tactic) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TACTIC_PRESETS.map((p) => {
        const active = Object.entries(p.tactic).every(([k, v]) => tactic[k as keyof Tactic] === v);
        return (
          <button key={p.id} type="button" title={p.description} onClick={() => onChange({ ...tactic, ...p.tactic })}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-gold-500 bg-gold-500/15 text-gold-300' : 'border-navy-600 bg-navy-900 text-slate-300 hover:text-white'}`}>
            {p.name}
          </button>
        );
      })}
    </div>
  );
}

/** 전술이 경기에 미치는 영향 요약 (사용자 이해용) */
export function tacticHints(t: Tactic): string[] {
  const h: string[] = [];
  if (t.mentality === 'attacking') h.push('공격력↑ 수비력↓');
  if (t.mentality === 'defensive') h.push('수비력↑ 공격력↓');
  if (t.pressing === 'high') h.push('중원 장악↑ 체력 소모 큼');
  if (t.defensiveLine === 'high') h.push('빠른 공격수에게 뒷공간 노출');
  if (t.passing === 'short') h.push('점유율↑');
  if (t.passing === 'direct') h.push('찬스 빈도↑ 패스 성공률↓');
  if (t.counterAttack) h.push('상대가 공격적일 때 역습 효과');
  if (t.tempo === 'fast') h.push('찬스↑ 체력 소모↑');
  return h;
}
