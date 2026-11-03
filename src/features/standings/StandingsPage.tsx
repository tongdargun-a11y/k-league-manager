import { Link } from 'react-router-dom';
import { useWorld } from '../../store/gameStore';
import { standingsOf } from '../../engine/world';
import { ClubBadge } from '../../components/ClubBadge';
import { FormDots, Panel } from '../../components/ui';

export function StandingsPage() {
  const world = useWorld();
  const table = standingsOf(world);
  const uid = world.userClubId;
  const fmt = world.competition.format;
  const leaders = (key: 'goals' | 'assists') =>
    Object.values(world.seasonStats)
      .filter((s) => s.seasonId === world.season.id && s[key] > 0)
      .sort((a, b) => b[key] - a[key] || a.appearances - b.appearances)
      .slice(0, 10);
  const tieLabel = fmt.tiebreakers.filter((t) => t !== 'name').map((t) => ({ goalDifference: '골득실', goalsFor: '다득점', wins: '다승', headToHead: '승자승' }[t as 'goalDifference'])).join(' → ');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">{world.competition.name} 순위</h1>
      <Panel className="overflow-x-auto p-0">
        <table className="table-base min-w-[640px]">
          <thead><tr><th className="w-10">#</th><th>구단</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득</th><th>실</th><th>득실</th><th>승점</th><th>최근 5경기</th></tr></thead>
          <tbody>
            {table.map((r, i) => (
              <tr key={r.clubId} className={r.clubId === uid ? 'bg-navy-700/70' : ''}>
                <td className="tabular-nums text-slate-400">{i + 1}</td>
                <td><span className={`flex items-center gap-2 ${r.clubId === uid ? 'font-bold text-gold-300' : 'text-white'}`}><ClubBadge club={world.clubs[r.clubId]} size={22} />{world.clubs[r.clubId].name}</span></td>
                <td className="tabular-nums">{r.played}</td><td className="tabular-nums">{r.won}</td><td className="tabular-nums">{r.drawn}</td><td className="tabular-nums">{r.lost}</td>
                <td className="tabular-nums">{r.goalsFor}</td><td className="tabular-nums">{r.goalsAgainst}</td>
                <td className="tabular-nums">{r.goalDifference > 0 ? '+' : ''}{r.goalDifference}</td>
                <td className="font-black tabular-nums text-white">{r.points}</td>
                <td><FormDots form={r.form} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <p className="text-xs text-slate-500">승점 규칙: 승 {fmt.pointsForWin} · 무 {fmt.pointsForDraw} · 패 {fmt.pointsForLoss}. 동률 시 {tieLabel} 순. {fmt.description}</p>

      <div className="grid gap-4 md:grid-cols-2">
        {(['goals', 'assists'] as const).map((key) => (
          <Panel key={key} title={key === 'goals' ? '득점 순위' : '도움 순위'}>
            {leaders(key).length === 0 ? <p className="text-sm text-slate-500">기록 없음</p> : (
              <ol className="space-y-1 text-sm">
                {leaders(key).map((s, i) => {
                  const p = world.players[s.playerId];
                  return (
                    <li key={s.playerId} className={`flex items-center gap-2 ${p.clubId === uid ? 'text-gold-300' : ''}`}>
                      <span className="w-5 text-right tabular-nums text-slate-400">{i + 1}</span>
                      <ClubBadge club={world.clubs[p.clubId]} size={18} />
                      <Link to={`/game/player/${p.id}`} className="flex-1 truncate hover:underline">{p.name}</Link>
                      <span className="text-xs text-slate-500">{s.appearances}경기</span>
                      <span className="w-6 text-right font-bold tabular-nums">{s[key]}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        ))}
      </div>

      {(world.history ?? []).length > 0 && (
        <Panel title="역대 기록">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>시즌</th><th>우승</th><th>우리 팀</th><th>득점왕</th><th>도움왕</th></tr></thead>
              <tbody>
                {[...world.history].reverse().map((h) => (
                  <tr key={h.seasonId}>
                    <td className="text-white">{h.label}</td>
                    <td><span className="flex items-center gap-1.5"><ClubBadge club={world.clubs[h.championId]} size={18} />{world.clubs[h.championId]?.shortName ?? h.championId}</span></td>
                    <td>{world.clubs[h.userClubId]?.shortName} {h.userRank}위</td>
                    <td className="text-xs">{h.topScorer ? `${h.topScorer.name} ${h.topScorer.value}골` : '-'}</td>
                    <td className="text-xs">{h.topAssister ? `${h.topAssister.name} ${h.topAssister.value}도움` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
