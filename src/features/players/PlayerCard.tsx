import type { Player, PlayerCareerStats, Club } from '../../types';
import { PlayerPhoto } from '../../components/PlayerPhoto';
import { playerOvr, POSITION_LABEL } from '../../engine/ratings/ovr';
import { ageOn } from '../../utils/date';
import { Award } from 'lucide-react';

/**
 * 선수 프로필 카드 — 다크 네이비·골드 세로형 카드.
 * 게임 내 기록(이 세이브에서 쌓인 기록)과 실제 기록(외부 출처)을 분리해서 표시한다.
 */
export function PlayerCard({ player, club, career, gameDate, seasonLabel, clubName = (id) => id }: { player: Player; club: Club; career: PlayerCareerStats; gameDate: string; seasonLabel: (seasonId: string) => string; clubName?: (clubId: string) => string }) {
  const ovr = playerOvr(player);
  const foot = player.foot === 'left' ? '왼발' : player.foot === 'both' ? '양발' : '오른발';
  return (
    <article className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-gold-600/50 bg-navy-900 shadow-[0_0_0_1px_rgba(212,166,63,0.15)]">
      {/* 상단 헤더 */}
      <header className="flex items-start justify-between border-b border-gold-600/30 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">{player.nationality} · {player.positions[0]}</div>
          <h2 className="mt-0.5 truncate text-2xl font-black text-white">{player.name}</h2>
          {player.nameEn && <div className="truncate text-xs text-slate-400">{player.nameEn}</div>}
        </div>
        <div className="text-right">
          <div className="text-4xl font-black leading-none text-gold-400 tabular-nums">{player.shirtNumber}</div>
          <div className="mt-1 text-[10px] text-slate-400">등번호</div>
        </div>
      </header>

      {/* 사진 + OVR */}
      <div className="relative">
        <PlayerPhoto player={player} className="aspect-[6/7] w-full" />
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          <div className="rounded-lg border border-gold-500/60 bg-navy-950/85 px-3 py-1.5 text-center">
            <div className="text-[9px] font-semibold tracking-widest text-gold-300">OVR</div>
            <div className="text-3xl font-black leading-none text-white tabular-nums">{ovr}</div>
          </div>
          <div className="rounded-lg border border-navy-600 bg-navy-950/85 px-3 py-1 text-center">
            <div className="text-[9px] font-semibold tracking-widest text-slate-400">PEAK</div>
            <div className="text-lg font-bold leading-none text-gold-300 tabular-nums">{Math.max(player.peakOvr, ovr)}</div>
          </div>
        </div>
        {!player.photoAssetId && (
          <div className="absolute bottom-3 right-3 rounded bg-navy-950/80 px-2 py-0.5 text-[10px] text-slate-400">사진 없음 · 기본 실루엣</div>
        )}
        <div className="absolute inset-x-0 bottom-0 grid grid-cols-4 gap-px bg-navy-950/40 text-center backdrop-blur-sm">
          {[['나이', `${ageOn(player.birthDate, gameDate)}`], ['신장', player.heightCm ? `${player.heightCm}` : '-'], ['주발', foot], ['소속', club.shortName]].map(([k, v]) => (
            <div key={k} className="bg-navy-900/80 py-1.5">
              <div className="text-[9px] text-slate-400">{k}</div>
              <div className="text-sm font-semibold text-white">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 통산 기록 */}
      <section className="px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">게임 내 통산</h3>
          <span className="text-[10px] text-slate-500">이 세이브 기준</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[['출전', career.appearances], ['득점', career.goals], ['도움', career.assists], ['평점', career.averageRating?.toFixed(2) ?? '-']].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-navy-700 bg-navy-850 py-2">
              <div className="text-xl font-black text-white tabular-nums">{v}</div>
              <div className="text-[10px] text-slate-400">{k}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg border border-dashed border-navy-600 px-3 py-2 text-xs text-slate-400">
          실제 통산 기록: {player.externalCareer ? `${player.externalCareer.appearances}경기 ${player.externalCareer.goals}골 ${player.externalCareer.assists}도움 (출처: ${player.externalCareer.source})` : '기록 없음 (테스트 데이터)'}
        </div>
      </section>

      {/* 우승·수상 */}
      <section className="border-t border-navy-700 px-5 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">우승·수상</h3>
        {career.honours.length === 0 ? <p className="text-xs text-slate-500">기록 없음</p> : (
          <ul className="space-y-1">
            {career.honours.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm"><Award size={14} className="text-gold-400" /> {h.seasonLabel} {h.title} <span className="text-[10px] text-slate-500">({h.origin === 'game' ? '게임' : '실제'})</span></li>
            ))}
          </ul>
        )}
      </section>

      {/* 시즌별 커리어 */}
      <section className="border-t border-navy-700 px-5 py-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-400">시즌별 커리어</h3>
        {career.seasons.length === 0 ? <p className="text-xs text-slate-500">기록 없음</p> : (
          <table className="w-full text-xs">
            <thead className="text-slate-400"><tr><th className="py-1 text-left font-medium">시즌</th><th className="text-left font-medium">구단</th><th className="text-right font-medium">출전</th><th className="text-right font-medium">골</th><th className="text-right font-medium">도움</th><th className="text-right font-medium">평점</th></tr></thead>
            <tbody>
              {career.seasons.map((s) => (
                <tr key={s.seasonId} className="border-t border-navy-700/60">
                  <td className="py-1">{seasonLabel(s.seasonId)}</td><td>{clubName(s.clubId)}</td>
                  <td className="text-right tabular-nums">{s.appearances}</td><td className="text-right tabular-nums">{s.goals}</td>
                  <td className="text-right tabular-nums">{s.assists}</td><td className="text-right tabular-nums">{s.ratingCount ? (s.ratingSum / s.ratingCount).toFixed(2) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <footer className="border-t border-navy-700 px-5 py-2 text-[10px] text-slate-500">{POSITION_LABEL[player.positions[0]]} · 능력치는 게임용 추정치입니다</footer>
    </article>
  );
}
