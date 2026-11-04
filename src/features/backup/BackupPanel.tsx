import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { backupRepository } from '../../repositories/saveRepository';
import { backupFileName, parseBackup } from '../../repositories/backup';
import { WORLD_SCHEMA_VERSION } from '../../engine/world';

/** 전체 백업 (모든 세이브 + 가져온 데이터셋 + 선택 시 개인 이미지)을 JSON 파일로 내려받는다. */
export function BackupPanel({ onRestored }: { onRestored?: () => void }) {
  const [counts, setCounts] = useState<{ saves: number; datasets: number; images: number } | null>(null);
  const [includeImages, setIncludeImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refreshCounts = () => { void backupRepository.counts().then(setCounts).catch(() => setCounts(null)); };
  useEffect(refreshCounts, []);

  const restore = async (file: File) => {
    setBusy(true);
    setMsg('');
    try {
      const parsed = parseBackup(await file.text(), WORLD_SCHEMA_VERSION);
      if (!parsed.ok || !parsed.backup) {
        setMsg(`복구 거부: ${parsed.errors.join(' ')}`);
        return;
      }
      const b = parsed.backup;
      if (!window.confirm(`세이브 ${b.counts.saves}개, 데이터셋 ${b.counts.datasets}개, 이미지 ${b.counts.images}개를 새 항목으로 추가합니다. 기존 데이터는 바뀌지 않습니다. 진행할까요?`)) return;
      const r = await backupRepository.restore(b);
      const warn = parsed.warnings.length ? ` · 건너뜀: ${parsed.warnings.join(', ')}` : '';
      const skip = r.skippedImages ? ` · 같은 이름이 있어 건너뛴 이미지 ${r.skippedImages}개` : '';
      setMsg(r.verified
        ? `복구 완료: 세이브 ${r.saves}개, 데이터셋 ${r.datasets}개, 이미지 ${r.images}개 (무결성 검사 통과)${skip}${warn}`
        : `복구는 저장됐지만 검사에서 문제 발견: ${r.problems.join(', ')}`);
      refreshCounts();
      onRestored?.();
    } catch (e) {
      setMsg(`복구 실패 (아무것도 저장되지 않음): ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setMsg('');
    try {
      const backup = await backupRepository.exportAll({ includeImages });
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(backup.exportedAt);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg(`백업 완료: 세이브 ${backup.counts.saves}개, 데이터셋 ${backup.counts.datasets}개, 이미지 ${backup.counts.images}개`);
    } catch (e) {
      setMsg(`백업 실패: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">
        이 브라우저에 저장된 세이브 {counts?.saves ?? '-'}개 · 가져온 데이터셋 {counts?.datasets ?? '-'}개 · 개인 이미지 {counts?.images ?? '-'}개
      </p>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />
        개인 이미지도 포함 (파일이 커질 수 있음)
      </label>
      <button className="btn-ghost w-full" onClick={download} disabled={busy} data-testid="backup-all">
        <Download size={16} /> {busy ? '백업 중…' : '전체 백업 파일 내려받기 (JSON)'}
      </button>
      <label className={`btn-ghost w-full cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
        <Upload size={16} /> 백업 파일에서 복구 (새 세이브로 추가)
        <input type="file" accept="application/json,.json" className="hidden" data-testid="restore-file"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void restore(f); }} />
      </label>
      {msg && <p className="text-xs text-gold-300" role="status">{msg}</p>}
      <p className="text-[11px] text-slate-500">백업은 데이터를 읽기만 합니다. 복구는 항상 새 세이브로 추가되며 기존 세이브를 덮어쓰지 않습니다.</p>
    </div>
  );
}
