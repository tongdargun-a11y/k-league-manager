import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FolderOpen, Save, Trash2 } from 'lucide-react';
import { useGame, useWorld } from '../../store/gameStore';
import { Panel } from '../../components/ui';
import { ClubBadge } from '../../components/ClubBadge';
import { formatKorean } from '../../utils/date';
import { DATA_NOTICE } from '../../data';
import { WORLD_SCHEMA_VERSION } from '../../engine/world';
import { BackupPanel } from '../backup/BackupPanel';

export function SavesPage() {
  const world = useWorld();
  const saves = useGame((s) => s.saves);
  const saveId = useGame((s) => s.saveId);
  const saveName = useGame((s) => s.saveName);
  const lastSavedAt = useGame((s) => s.lastSavedAt);
  const refresh = useGame((s) => s.refreshSaves);
  const saveGame = useGame((s) => s.saveGame);
  const load = useGame((s) => s.loadGame);
  const del = useGame((s) => s.deleteSave);
  const live = useGame((s) => s.live);
  const navigate = useNavigate();
  const [name, setName] = useState(saveName);

  useEffect(() => { void refresh(); }, [refresh, lastSavedAt]);
  useEffect(() => setName(saveName), [saveName]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: WORLD_SCHEMA_VERSION, exportedAt: new Date().toISOString(), world }, null, 0)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `k-league-manager-${world.clock.gameDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black text-white">저장·설정</h1>
      <Panel title="현재 게임 저장">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1">
            <span className="text-xs text-slate-400">세이브 이름</span>
            <input className="input mt-1" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn-gold" onClick={() => saveGame({ name })}><Save size={16} /> 저장</button>
          <button className="btn-ghost" onClick={exportJson} title="세이브를 JSON 파일로 내려받기 (백업용)"><Download size={16} /> 백업 파일</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">마지막 저장: {lastSavedAt ? new Date(lastSavedAt).toLocaleString('ko-KR') : '없음'} · 세이브 버전 v{WORLD_SCHEMA_VERSION}</p>
        <p className="mt-1 text-xs text-slate-500">자동 저장 시점: 새 게임 생성, 날짜 진행 7일마다, 날짜 진행 정지·경기일 도착·이적 제안 도착, 킥오프·하프타임, 경기 결과 반영 후. 저장은 브라우저(IndexedDB)에만 되며 다른 기기와 공유되지 않습니다.</p>
      </Panel>

      <Panel title="전체 데이터 백업">
        <BackupPanel onRestored={() => void refresh()} />
      </Panel>

      <Panel title="세이브 목록">
        <ul className="divide-y divide-navy-700">
          {saves.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <ClubBadge club={world.clubs[s.selectedClubId]} size={28} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{s.name} {s.id === saveId && <span className="ml-1 rounded bg-gold-500/20 px-1.5 text-[10px] text-gold-300">현재</span>}</div>
                <div className="text-xs text-slate-400">게임 날짜 {formatKorean(s.gameDate, false)} · {new Date(s.updatedAt).toLocaleString('ko-KR')}</div>
              </div>
              {s.id !== saveId && (
                <button className="btn-ghost px-2.5 py-1.5" disabled={!!live} onClick={async () => { if (window.confirm('현재 진행 상황 중 저장하지 않은 부분은 사라집니다. 불러올까요?') && (await load(s.id))) navigate('/game'); }}>
                  <FolderOpen size={14} /> 불러오기
                </button>
              )}
              <button className="rounded p-1.5 text-slate-500 hover:bg-navy-700 hover:text-rose-300" disabled={s.id === saveId} aria-label="삭제"
                title={s.id === saveId ? '현재 플레이 중인 세이브는 삭제할 수 없습니다' : '삭제'}
                onClick={() => { if (window.confirm(`'${s.name}' 세이브를 삭제할까요? 되돌릴 수 없습니다.`)) void del(s.id); }}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-ghost mt-3" onClick={() => navigate('/new')} disabled={!!live}>새 게임 시작</button>
      </Panel>

      <Panel title="데이터 안내">
        <p className="text-sm leading-relaxed text-slate-300">{DATA_NOTICE}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
          <li>선수 이름은 무작위 조합으로 생성한 가상 인물이며 실존 선수와 무관합니다.</li>
          <li>선수 사진은 권리가 확인된 파일만 사용합니다. 현재는 포지션별 기본 실루엣을 표시합니다.</li>
          <li>일정과 대회 규칙은 테스트용 설정(src/data/index.ts)이며 실제 시즌 일정과 다릅니다.</li>
          <li>직접 확보한 선수 데이터는 타이틀 화면의 'CSV/JSON 가져오기'로 데이터셋을 만든 뒤 새 게임에서 선택할 수 있습니다. (진행 중인 세이브에는 적용되지 않습니다)</li>
        </ul>
      </Panel>
    </div>
  );
}
