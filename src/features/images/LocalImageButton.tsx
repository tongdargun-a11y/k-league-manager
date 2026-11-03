import { ImagePlus, X } from 'lucide-react';
import { useLocalImage, useLocalImages } from '../../store/localImages';
import { useGame } from '../../store/gameStore';

/** 개인용 이미지 추가·교체·삭제 버튼 (이 브라우저에만 저장) */
export function LocalImageButton({ imageKey, label = '이미지' }: { imageKey: string; label?: string }) {
  const url = useLocalImage(imageKey);
  const { set, remove } = useLocalImages.getState();
  const toast = useGame((s) => s.toast);
  return (
    <span className="inline-flex items-center gap-1">
      <label className="btn-ghost cursor-pointer px-2 py-1 text-xs">
        <ImagePlus size={14} /> {url ? '교체' : `${label} 추가`}
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) set(imageKey, f).catch((err: Error) => toast(err.message, 'error'));
        }} />
      </label>
      {url && (
        <button className="rounded p-1 text-slate-500 hover:bg-navy-700 hover:text-rose-300" aria-label="이미지 삭제" onClick={() => void remove(imageKey)}>
          <X size={14} />
        </button>
      )}
    </span>
  );
}
