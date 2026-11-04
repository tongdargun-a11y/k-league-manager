import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, FolderOpen, Play, Plus, Trash2 } from 'lucide-react';
import { useGame } from '../../store/gameStore';
import { prefs } from '../../repositories/saveRepository';
import { DATA_NOTICE } from '../../data';
import type { SaveListItem } from '../../repositories/saveRepository';
import { formatKorean } from '../../utils/date';
import { ClubBadge } from '../../components/ClubBadge';
import { TestDataBadge } from '../../components/TestDataBadge';
import { BackupPanel } from '../backup/BackupPanel';

export function TitlePage() {
  const navigate = useNavigate();
  const saves = useGame((s) => s.saves);
  const refresh = useGame((s) => s.refreshSaves);
  const load = useGame((s) => s.loadGame);
  const del = useGame((s) => s.deleteSave);

  useEffect(() => { void refresh(); }, [refresh]);
  const lastId = prefs.getLastSaveId();
  const last = saves.find((s) => s.id === lastId) ?? saves[0];

  const current = saves.filter((s) => !s.legacy);
  const legacy = saves.filter((s) => s.legacy);

  const open = async (id: string) => {
    if (await load(id)) navigate('/game');
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="text-xs font-semibold tracking-[0.4em] text-gold-400">SOLEA PREMIER DIVISION</div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">VIRTUAL <span className="text-gold-400">FOOTBALL MANAGER</span></h1>
          <div className="mt-3 flex justify-center"><TestDataBadge text="개발 버전 · 가상 세계관" /></div>
        </div>

        <div className="panel space-y-3 p-5">
          {last && (
            <button className="btn-gold w-full py-3 text-base" onClick={() => open(last.id)}>
              <Play size={18} /> 이어하기 — {last.managerName} · {last.club?.shortName ?? last.selectedClubId} · {formatKorean(last.gameDate, false)}{last.legacy ? ' (구버전)' : ''}
            </button>
          )}
          <button className={`${last ? 'btn-ghost' : 'btn-gold'} w-full py-3 text-base`} onClick={() => navigate('/new')}>
            <Plus size={18} /> 새 게임
          </button>
          <button className="btn-ghost w-full" onClick={() => navigate('/import')}>
            <FileUp size={16} /> 선수 데이터 편집·가져오기 (CSV/JSON)
          </button>
          {/* 개인용 로고·사진 메뉴는 숨김 (PHASE 0: 픽셀 캐릭터로 대체 예정, /images 화면 코드는 유지) */}
        </div>

        <div className="panel mt-4 p-5">
          <h2 className="panel-title mb-3 flex items-center gap-2"><FolderOpen size={14} /> 세이브 불러오기</h2>
          {current.length === 0 ? (
            <p className="text-sm text-slate-400">저장된 게임이 없습니다. 새 게임을 시작하세요.</p>
          ) : (
            <ul className="divide-y divide-navy-700">{current.map((s) => <SaveRow key={s.id} s={s} onOpen={open} onDelete={del} />)}</ul>
          )}
        </div>

        {legacy.length > 0 && (
          <div className="panel mt-4 p-5" data-testid="legacy-saves">
            <h2 className="panel-title mb-1 flex items-center gap-2"><FolderOpen size={14} /> 구버전 세이브 (원본 보존)</h2>
            <p className="mb-2 text-xs text-slate-400">이전 버전에서 만든 세이브입니다. 불러와서 플레이할 수 있고, 저장하면 새 세이브로 이어집니다. 원본은 바뀌거나 삭제되지 않습니다.</p>
            <ul className="divide-y divide-navy-700">{legacy.map((s) => <SaveRow key={s.id} s={s} onOpen={open} onDelete={del} />)}</ul>
          </div>
        )}
        <div className="panel mt-4 p-5">
          <h2 className="panel-title mb-3">데이터 백업</h2>
          <BackupPanel onRestored={() => void refresh()} />
        </div>
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">{DATA_NOTICE}</p>
      </div>
    </div>
  );
}

function SaveRow({ s, onOpen, onDelete }: { s: SaveListItem; onOpen: (id: string) => void; onDelete: (id: string) => Promise<void> }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <ClubBadge club={s.club} size={30} />
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(s.id)}>
        <div className="truncate text-sm font-semibold text-white hover:text-gold-400">
          {s.name} {s.legacy && <span className="ml-1 rounded bg-slate-500/30 px-1.5 text-[10px] text-slate-300">구버전 v{s.schemaVersion}</span>}
        </div>
        <div className="text-xs text-slate-400">{s.club?.name ?? s.selectedClubId} · 게임 날짜 {formatKorean(s.gameDate, false)} · 저장 {new Date(s.updatedAt).toLocaleString('ko-KR')}</div>
      </button>
      {!s.legacy && (
        <button
          className="rounded p-1.5 text-slate-500 hover:bg-navy-700 hover:text-rose-300"
          aria-label={`${s.name} 삭제`}
          onClick={() => { if (window.confirm(`'${s.name}' 세이브를 삭제할까요? 되돌릴 수 없습니다.`)) void onDelete(s.id); }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </li>
  );
}
