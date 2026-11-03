import { useEffect } from 'react';
import { create } from 'zustand';
import { imageRepository } from '../repositories/saveRepository';

/**
 * 개인용 로컬 이미지 (구단 로고·선수 사진).
 * 사용자가 자기 브라우저에 직접 추가한 파일만 IndexedDB에 저장한다. 서버 업로드·저장소 커밋·배포 없음.
 */
interface LocalImageStore {
  urls: Record<string, string>;
  loaded: boolean;
  load(): Promise<void>;
  set(key: string, file: File): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export const clubImageKey = (clubId: string) => `club:${clubId}`;
export const playerImageKey = (playerId: string) => `player:${playerId}`;

/** 큰 사진은 저장 전에 최대 크기로 줄인다 (용량 절약). */
async function shrink(file: File, max = 320): Promise<Blob> {
  if (file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? file), 'image/png'));
  } catch {
    return file;
  }
}

export const useLocalImages = create<LocalImageStore>((set, get) => ({
  urls: {},
  loaded: false,
  async load() {
    if (get().loaded) return;
    try {
      const rows = await imageRepository.all();
      set({ urls: Object.fromEntries(rows.map((r) => [r.key, URL.createObjectURL(r.blob)])), loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  async set(key, file) {
    if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 추가할 수 있습니다.');
    if (file.size > 5 * 1024 * 1024) throw new Error('파일이 너무 큽니다 (최대 5MB).');
    const blob = await shrink(file);
    await imageRepository.put(key, blob);
    const old = get().urls[key];
    if (old) URL.revokeObjectURL(old);
    set({ urls: { ...get().urls, [key]: URL.createObjectURL(blob) } });
  },
  async remove(key) {
    await imageRepository.remove(key);
    const { [key]: old, ...rest } = get().urls;
    if (old) URL.revokeObjectURL(old);
    set({ urls: rest });
  },
  async clear() {
    await imageRepository.clear();
    Object.values(get().urls).forEach((u) => URL.revokeObjectURL(u));
    set({ urls: {} });
  },
}));

/** 이미지 하나의 URL (없으면 undefined). 첫 사용 시 자동으로 불러온다. */
export function useLocalImage(key: string): string | undefined {
  const url = useLocalImages((s) => s.urls[key]);
  useEffect(() => { void useLocalImages.getState().load(); }, []);
  return url;
}
