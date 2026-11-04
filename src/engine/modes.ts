import type { GameMode, WorldState } from '../types';

/**
 * 플레이 모드와 권한 표 (PHASE 1).
 * - 'classic': 모드가 없는 세이브(PHASE 0 이전·직후). 지금까지처럼 모든 기능 사용.
 * 메뉴 표시, 화면 접근, 스토어 동작을 모두 이 표로 판단한다.
 */
export type ModeKey = GameMode | 'classic';

export interface ModeCapabilities {
  finance: boolean;        // 재정 화면·예산 운영
  transfers: boolean;      // 영입·방출·계약 (감독은 PHASE 2에서 '요청' 방식으로 바뀜)
  tactics: boolean;        // 전술·라인업 설정
  liveMatch: boolean;      // 경기 직접 지휘 (아니면 자동 진행)
  teamTraining: boolean;   // 팀 훈련 계획
  facilities: boolean;     // 시설·팬 (구단운영 전용)
  transferDirect: boolean; // 직접 영입·방출·재계약 (감독은 이사회에 요청만)
  playable: boolean;       // 현재 플레이 가능 여부
}

export const MODE_CAPABILITIES: Record<ModeKey, ModeCapabilities> = {
  classic: { finance: true, transfers: true, tactics: true, liveMatch: true, teamTraining: true, facilities: false, transferDirect: true, playable: true },
  club: { finance: true, transfers: true, tactics: false, liveMatch: false, teamTraining: false, facilities: true, transferDirect: true, playable: true },
  manager: { finance: false, transfers: true, tactics: true, liveMatch: true, teamTraining: true, facilities: false, transferDirect: false, playable: true },
  player: { finance: false, transfers: false, tactics: false, liveMatch: false, teamTraining: false, facilities: false, transferDirect: false, playable: false },
};

export const MODE_INFO: Record<GameMode, { label: string; role: string; desc: string }> = {
  club: { label: '구단운영', role: '구단 대표', desc: '예산·재정, 영입과 방출, 계약을 맡습니다. 경기는 AI 감독이 치르고 결과를 받아 봅니다.' },
  manager: { label: '감독', role: '감독', desc: '전술, 선발 명단, 경기 중 교체와 전술 변경을 맡습니다. 구단 재정은 직접 운영하지 않습니다.' },
  player: { label: '선수', role: '선수', desc: '한 명의 선수로 훈련하고 성장하며 커리어를 쌓습니다. (준비 중)' },
};

export const modeOf = (w: Pick<WorldState, 'mode'> | null | undefined): ModeKey => w?.mode ?? 'classic';
export const capsOf = (w: Pick<WorldState, 'mode'> | null | undefined): ModeCapabilities => MODE_CAPABILITIES[modeOf(w)];

/** 화면 경로별 필요 권한 (없으면 모두 허용) */
export const ROUTE_CAP: Record<string, keyof ModeCapabilities> = {
  '/game/finance': 'finance',
  '/game/transfers': 'transfers',
  '/game/tactics': 'tactics',
  '/game/match': 'liveMatch',
  '/game/training': 'teamTraining',
  '/game/club': 'facilities',
};

export function canOpen(w: Pick<WorldState, 'mode'> | null | undefined, path: string): boolean {
  const cap = ROUTE_CAP[path];
  return !cap || capsOf(w)[cap];
}
