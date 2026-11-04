import type { SeasonLength } from '../data';
import { create } from 'zustand';
import type { ClockSpeed, GameMode, Lineup, Tactic, WorldState } from '../types';
import {
  advanceDay, applyMatchResult, checkSeasonEnd, createNewWorld, fixtureFor, prepareMatch, simulateDueAIFixtures,
} from '../engine/world';
import {
  autoReplaceInjured, canSubstitute, changeTactic, simulateToEnd, stepMinute, substitute, type MatchState, type SideKey,
} from '../engine/match/engine';
import { validateLineup } from '../engine/match/lineup';
import { uid } from '../utils/id';
import { capsOf } from '../engine/modes';
import { saveRepository, prefs, datasetRepository, type SaveListItem } from '../repositories/saveRepository';

export type LiveSpeed = 'slow' | 'normal' | 'fast';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'error';
}

interface GameStore {
  world: WorldState | null;
  saveId: string | null;
  saveName: string;
  saveCreatedAt: string | null;
  clockSpeed: ClockSpeed;
  saving: boolean;
  lastSavedAt: string | null;
  saves: SaveListItem[];
  /** 구버전 세이브를 불러와 플레이 중이면 그 원본 id (원본은 덮어쓰지 않고 새 세이브로 저장) */
  legacySourceId: string | null;
  toasts: Toast[];
  daysSinceSave: number;

  live: MatchState | null;
  liveRunning: boolean;
  liveSpeed: LiveSpeed;

  // 세이브
  refreshSaves(): Promise<void>;
  newGame(managerName: string, clubId: string, datasetId?: string | null, mode?: GameMode, seasonLength?: SeasonLength): Promise<void>;
  /** 엔진 함수로 월드를 갱신 (이적·재정·훈련 등 화면 조작용) */
  mutate(fn: (w: WorldState) => WorldState): void;
  loadGame(id: string): Promise<boolean>;
  saveGame(opts?: { silent?: boolean; name?: string }): Promise<void>;
  deleteSave(id: string): Promise<void>;
  exitToTitle(): void;

  // 시간
  setClockSpeed(speed: ClockSpeed): void;
  advanceOneDay(): void;

  // 팀 관리
  setLineup(lineup: Lineup): void;
  setTactic(tactic: Tactic): void;

  // 경기
  startMatch(): { ok: boolean; reason?: string };
  matchStep(): void;
  setLiveRunning(running: boolean): void;
  setLiveSpeed(speed: LiveSpeed): void;
  matchSubstitute(outId: string, inId: string): { ok: boolean; reason?: string };
  matchChangeTactic(tactic: Tactic): void;
  simulateRest(): void;
  finishMatch(): void;

  toast(text: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
}

let saveChain: Promise<unknown> = Promise.resolve();
let toastSeq = 0;
const AUTOSAVE_EVERY_DAYS = 7;

export const useGame = create<GameStore>((set, get) => ({
  world: null,
  saveId: null,
  saveName: '',
  saveCreatedAt: null,
  clockSpeed: 'paused',
  saving: false,
  lastSavedAt: null,
  saves: [],
  legacySourceId: null,
  toasts: [],
  daysSinceSave: 0,
  live: null,
  liveRunning: false,
  liveSpeed: 'normal',

  async refreshSaves() {
    try {
      set({ saves: await saveRepository.list() });
    } catch (e) {
      get().toast(`세이브 목록을 불러오지 못했습니다: ${(e as Error).message}`, 'error');
    }
  },

  async newGame(managerName, clubId, datasetId, mode, seasonLength) {
    const ds = datasetId ? await datasetRepository.get(datasetId) : undefined;
    const world = createNewWorld({ managerName, clubId, importedPlayers: ds?.players, mode, worldId: uid('world'), seasonLength });
    set({ world, saveId: null, legacySourceId: null, saveName: '', saveCreatedAt: null, clockSpeed: 'paused', live: null, liveRunning: false, daysSinceSave: 0 });
    await get().saveGame({ silent: true });
  },

  mutate(fn) {
    const { world } = get();
    if (!world) return;
    set({ world: fn(world) });
  },

  async loadGame(id) {
    try {
      const loaded = await saveRepository.loadForPlay(id);
      if (!loaded) {
        get().toast('세이브를 찾을 수 없습니다.', 'error');
        return false;
      }
      const { save, legacy } = loaded;
      set({
        world: save.world,
        // 구버전: 원본 id를 쓰지 않으므로 다음 저장(자동 저장 포함)은 새 세이브로 만들어진다
        saveId: legacy ? null : save.id,
        saveName: legacy ? `${save.name} (이어하기)` : save.name,
        saveCreatedAt: legacy ? null : save.createdAt,
        legacySourceId: legacy ? save.id : null,
        lastSavedAt: save.updatedAt,
        clockSpeed: 'paused',
        live: save.world.liveMatch,
        liveRunning: false,
        daysSinceSave: 0,
      });
      prefs.setLastSaveId(save.id);
      if (legacy) get().toast('구버전 세이브입니다. 원본은 그대로 보존하고, 저장하면 새 세이브로 이어집니다.', 'info');
      return true;
    } catch (e) {
      get().toast(`불러오기 실패: ${(e as Error).message}`, 'error');
      return false;
    }
  },

  saveGame(opts = {}) {
    // 저장 요청을 순서대로 처리 (동시 쓰기 방지)
    const run = async () => {
      const { world, saveId, saveName, saveCreatedAt } = get();
      if (!world) return;
      set({ saving: true });
      try {
        const save = await saveRepository.write({
          id: saveId ?? undefined,
          name: opts.name ?? saveName,
          world,
          createdAt: saveCreatedAt ?? undefined,
        });
        set({ saveId: save.id, saveName: save.name, saveCreatedAt: save.createdAt, lastSavedAt: save.updatedAt, daysSinceSave: 0 });
        prefs.setLastSaveId(save.id);
        if (!opts.silent) get().toast('저장했습니다.', 'success');
      } catch (e) {
        get().toast(`저장 실패: ${(e as Error).message}`, 'error');
      } finally {
        set({ saving: false });
      }
    };
    const p = saveChain.then(run, run);
    saveChain = p;
    return p;
  },

  async deleteSave(id) {
    try {
      await saveRepository.remove(id);
    } catch (e) {
      get().toast((e as Error).message, 'error');
      return;
    }
    if (prefs.getLastSaveId() === id) prefs.setLastSaveId(null);
    await get().refreshSaves();
  },

  exitToTitle() {
    set({ world: null, saveId: null, legacySourceId: null, clockSpeed: 'paused', live: null, liveRunning: false });
  },

  setClockSpeed(speed) {
    const { world } = get();
    if (!world) return;
    if (speed !== 'paused') {
      const today = fixtureFor(world, world.clock.gameDate, world.userClubId);
      if (today && today.status !== 'played' && capsOf(world).liveMatch) {
        get().toast('오늘은 경기일입니다. 경기를 먼저 진행하세요.', 'warn');
        set({ clockSpeed: 'paused' });
        return;
      }
      if (world.season.status === 'finished') {
        get().toast('시즌이 종료되었습니다.', 'info');
        return;
      }
    }
    const wasRunning = get().clockSpeed !== 'paused';
    set({ clockSpeed: speed });
    if (speed === 'paused' && wasRunning && get().daysSinceSave > 0) void get().saveGame({ silent: true });
  },

  advanceOneDay() {
    const { world } = get();
    if (!world) return;
    const r = advanceDay(world);
    if (!r.advanced) {
      set({ clockSpeed: 'paused' });
      if (r.stopReason === 'match-day') get().toast('오늘은 경기일입니다. 경기를 시작하세요.', 'warn');
      return;
    }
    const days = get().daysSinceSave + 1;
    set({ world: r.world, daysSinceSave: days });
    if (r.stopReason) {
      set({ clockSpeed: 'paused' });
      if (r.stopReason === 'match-day') get().toast('경기일입니다! 대시보드에서 경기를 시작하세요.', 'info');
      if (r.stopReason === 'season-end') get().toast('시즌이 종료되었습니다.', 'success');
      if (r.stopReason === 'injury-return') get().toast('부상 선수가 복귀했습니다.', 'info');
      if (r.stopReason === 'transfer-offer') get().toast('우리 선수에게 이적 제안이 들어왔습니다. 이적시장에서 확인하세요.', 'info');
      void get().saveGame({ silent: true });
    } else if (days >= AUTOSAVE_EVERY_DAYS) {
      void get().saveGame({ silent: true });
    }
  },

  setLineup(lineup) {
    const { world } = get();
    if (!world || !capsOf(world).tactics) return;
    set({ world: { ...world, userLineup: lineup, tactics: { ...world.tactics, [world.userClubId]: { ...world.tactics[world.userClubId], formation: lineup.formation } } } });
  },

  setTactic(tactic) {
    const { world } = get();
    if (!world || !capsOf(world).tactics) return;
    set({ world: { ...world, tactics: { ...world.tactics, [world.userClubId]: tactic }, userLineup: { ...world.userLineup, formation: tactic.formation } } });
  },

  startMatch() {
    const { world, live } = get();
    if (!world) return { ok: false, reason: '게임이 없습니다.' };
    if (!capsOf(world).liveMatch) return { ok: false, reason: '이 모드에서는 경기를 직접 지휘하지 않습니다.' };
    if (live && live.phase !== 'finished') return { ok: true };
    const fixture = fixtureFor(world, world.clock.gameDate, world.userClubId);
    if (!fixture || fixture.status === 'played') return { ok: false, reason: '오늘은 경기가 없습니다.' };
    const issues = validateLineup(world.userLineup, world.players, world.competition.format.benchSize).filter((i) => i.level === 'error');
    if (issues.length) return { ok: false, reason: issues[0].message };
    const state = prepareMatch(world, fixture);
    set({ live: state, liveRunning: false, clockSpeed: 'paused', world: { ...world, liveMatch: state } });
    void get().saveGame({ silent: true });
    return { ok: true };
  },

  matchStep() {
    const { live, world } = get();
    if (!live || !world || live.phase === 'finished') return;
    const prevPhase = live.phase;
    const next = stepMinute(live, world.players);
    const patch: Partial<GameStore> = { live: next };
    if (next.attentionRequired) {
      patch.liveRunning = false;
      get().toast(next.attentionRequired, 'warn');
    }
    if (next.phase === 'halftime' && prevPhase !== 'halftime') {
      patch.liveRunning = false;
      patch.world = { ...world, liveMatch: next };
      set(patch);
      void get().saveGame({ silent: true });
      return;
    }
    if (next.phase === 'finished') patch.liveRunning = false;
    set(patch);
  },

  setLiveRunning(running) {
    const { live } = get();
    if (!live || live.phase === 'finished') return set({ liveRunning: false });
    set({ liveRunning: running });
  },

  setLiveSpeed(speed) {
    set({ liveSpeed: speed });
  },

  matchSubstitute(outId, inId) {
    const { live, world } = get();
    if (!live || !world) return { ok: false, reason: '진행 중인 경기가 없습니다.' };
    const side: SideKey = live.home.isUser ? 'home' : 'away';
    const check = canSubstitute(live, side, outId, inId);
    if (!check.ok) return check;
    set({ live: substitute(live, side, outId, inId, world.players) });
    return { ok: true };
  },

  matchChangeTactic(tactic) {
    const { live, world } = get();
    if (!live || !world) return;
    const side: SideKey = live.home.isUser ? 'home' : 'away';
    set({ live: changeTactic(live, side, tactic, world.players) });
  },

  simulateRest() {
    const { live, world } = get();
    if (!live || !world) return;
    const side: SideKey = live.home.isUser ? 'home' : 'away';
    let s = autoReplaceInjured(live, side, world.players);
    s = simulateToEnd(structuredClone(s), world.players, { assistUser: true });
    set({ live: s, liveRunning: false });
  },

  finishMatch() {
    const { live, world } = get();
    if (!live || !world || live.phase !== 'finished') return;
    let w = applyMatchResult(world, live);
    w = simulateDueAIFixtures(w, w.clock.gameDate);
    w = checkSeasonEnd(w);
    w = { ...w, liveMatch: null };
    set({ world: w, live: null, liveRunning: false });
    void get().saveGame({ silent: true });
  },

  toast(text, tone = 'info') {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, text, tone }].slice(-4) });
    setTimeout(() => get().dismissToast(id), 4500);
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

/** 사용자 구단 기준 편의 셀렉터 */
export function useWorld(): WorldState {
  const world = useGame((s) => s.world);
  if (!world) throw new Error('게임이 로드되지 않았습니다.');
  return world;
}
