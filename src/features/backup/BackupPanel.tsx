import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { backupRepository } from '../../repositories/saveRepository';
import { backupFileName } from '../../repositories/backup';

/** 전체 백업 (모든 세이브 + 가져온 데이터셋 + 선택 시 개인 이미지)을 JSON 파일로 내려받는다. */
export function BackupPanel() {
  const [counts, setCounts] = useState<{ saves: number; datasets: number; images: number } | null>(null);
  const [includeImages, setIncludeImages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { void backupRepository.counts().then(setCounts).catch(() => setCounts(null)); }, []);

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
      {msg && <p className="text-xs text-gold-300" role="status">{msg}</p>}
      <p className="text-[11px] text-slate-500">백업은 데이터를 읽기만 하며 기존 세이브를 바꾸지 않습니다. 원본 세이브는 버전 변환 없이 그대로 담깁니다.</p>
    </div>
  );
}
