import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, FolderOpen, Play, Plus, Trash2 } from 'lucide-react';
import { useGame } from '../../store/gameStore';
import { prefs } from '../../repositories/saveRepository';
import { TEST_CLUBS, DATA_NOTICE } from '../../data';
import { formatKorean } from '../../utils/date';
import { ClubBadge } from '../../components/ClubBadge';
import { TestDataBadge } from '../../components/TestDataBadge';

export function TitlePage() {
  const navigate = useNavigate();
  const saves = useGame((s) => s.saves);
  const refresh = useGame((s) => s.refreshSaves);
  const load = useGame((s) => s.loadGame);
  const del = useGame((s) => s.deleteSave);

  useEffect(() => { void refresh(); }, [refresh]);
  const lastId = prefs.getLastSaveId();
  const last = saves.find((s) => s.id === lastId) ?? saves[0];

  const open = async (id: string) => {
    if (await load(id)) navigate('/game');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="text-xs font-semibold tracking-[0.4em] text-gold-400">FOOTBALL CLUB MANAGEMENT</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">K-LEAGUE <span className="text-gold-400">MANAGER</span></h1>
          <div className="mt-3 flex justify-center"><TestDataBadge text="개발 버전 · 테스트 데이터" /></div>
        </div>

        <div className="panel space-y-3 p-5">
          {last && (
            <button className="btn-gold w-full py-3 text-base" onClick={() => open(last.id)}>
              <Play size={18} /> 이어하기 — {last.managerName} · {TEST_CLUBS.find((c) => c.id === last.selectedClubId)?.shortName} · {formatKorean(last.gameDate, false)}
            </button>
          )}
          <button className={`${last ? 'btn-ghost' : 'btn-gold'} w-full py-3 text-base`} onClick={() => navigate('/new')}>
            <Plus size={18} /> 새 게임
          </button>
          <button className="btn-ghost w-full" onClick={() => navigate('/import')}>
            <FileUp size={16} /> 선수 데이터 가져오기 (CSV/JSON)
          </button>
        </div>

        <div className="panel mt-4 p-5">
          <h2 className="panel-title mb-3 flex items-center gap-2"><FolderOpen size={14} /> 세이브 불러오기</h2>
          {saves.length === 0 ? (
            <p className="text-sm text-slate-400">저장된 게임이 없습니다. 새 게임을 시작하세요.</p>
          ) : (
            <ul className="divide-y divide-navy-700">
              {saves.map((s) => {
                const club = TEST_CLUBS.find((c) => c.id === s.selectedClubId);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <ClubBadge club={club} size={30} />
                    <button className="min-w-0 flex-1 text-left" onClick={() => open(s.id)}>
                      <div className="truncate text-sm font-semibold text-white hover:text-gold-400">{s.name}</div>
                      <div className="text-xs text-slate-400">게임 날짜 {formatKorean(s.gameDate, false)} · 저장 {new Date(s.updatedAt).toLocaleString('ko-KR')}</div>
                    </button>
                    <button
                      className="rounded p-1.5 text-slate-500 hover:bg-navy-700 hover:text-rose-300"
                      aria-label={`${s.name} 삭제`}
                      onClick={() => { if (window.confirm(`'${s.name}' 세이브를 삭제할까요? 되돌릴 수 없습니다.`)) void del(s.id); }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">{DATA_NOTICE}</p>
      </div>
    </div>
  );
}
