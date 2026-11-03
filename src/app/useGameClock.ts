import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import type { ClockSpeed } from '../types';

/** 실시간 하루 간격 (ms) */
export const CLOCK_INTERVAL: Record<Exclude<ClockSpeed, 'paused'>, number> = {
  normal: 1400,
  fast: 600,
  veryFast: 180,
};

/**
 * 게임 시계. 일정 간격마다 하루씩 진행한다.
 * - setTimeout 체인을 써서 한 번에 하루만 처리 (밀린 타이머가 몰아서 실행되지 않음)
 * - 탭이 숨겨지면 자동 일시정지
 * - 라이브 경기 중에는 날짜 진행 중단
 */
export function useGameClock() {
  const speed = useGame((s) => s.clockSpeed);
  const hasLive = useGame((s) => !!s.live);

  useEffect(() => {
    if (speed === 'paused' || hasLive) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const st = useGame.getState();
      if (st.clockSpeed === 'paused' || st.live) return;
      st.advanceOneDay();
      if (useGame.getState().clockSpeed !== 'paused') timer = setTimeout(tick, CLOCK_INTERVAL[speed]);
    };
    timer = setTimeout(tick, CLOCK_INTERVAL[speed]);
    return () => clearTimeout(timer);
  }, [speed, hasLive]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && useGame.getState().clockSpeed !== 'paused') useGame.getState().setClockSpeed('paused');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
}
