import type { Club, Player, PlayerAppearance, PlayerModeState, Position, WorldState } from '../../types';
import { HOME_NATION } from '../../data';
import { makeAttributes, tuneToOvr } from '../../data/testPlayers';
import { createRng, hashString } from '../../utils/rng';
import { ovrForPosition } from '../ratings/ovr';
import { generateAppearance } from '../appearance';

/** 선수 모드: 새 게임에서 만드는 내 선수 (PHASE 3) */
export interface UserPlayerInput {
  name: string;
  position: Position;
  appearance?: PlayerAppearance;
}

export const USER_PLAYER_POSITIONS: Position[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

const SECONDARY: Partial<Record<Position, Position>> = { CB: 'DM', LB: 'LM', RB: 'RM', DM: 'CM', CM: 'DM', AM: 'CM', LW: 'LM', RW: 'RM', ST: 'AM' };

/** 18세 유망주. 시작 OVR은 구단 수준보다 낮고 잠재력은 높다. 같은 입력이면 같은 선수. */
export function createUserPlayer(input: UserPlayerInput, club: Club, squad: Player[], startDate: string, worldId = ''): Player {
  const seed = hashString(`me:${worldId}:${input.name}:${input.position}:${club.id}`);
  const rng = createRng(seed);
  const pos = input.position;
  const target = Math.max(45, Math.min(60, Math.round(50 + (club.reputation - 65) * 0.2)));
  const attributes = tuneToOvr(makeAttributes(rng, pos, target), pos, target);
  const ovr = ovrForPosition(attributes, pos);
  const used = new Set(squad.map((p) => p.shirtNumber));
  let shirt = pos === 'GK' ? 41 : 17;
  while (used.has(shirt)) shirt++;
  const year = Number(startDate.slice(0, 4));
  const id = `me-${seed.toString(36)}`;
  const sec = SECONDARY[pos];
  return {
    id,
    name: input.name.trim() || '신인',
    nationality: HOME_NATION,
    birthDate: `${year - 18}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    heightCm: pos === 'GK' || pos === 'CB' ? 186 : 176,
    weightKg: 70,
    positions: sec ? [pos, sec] : [pos],
    foot: pos.startsWith('L') ? 'left' : 'right',
    shirtNumber: shirt,
    clubId: club.id,
    contract: { startDate, endDate: `${year + 2}-12-31`, wage: 60 },
    attributes,
    potential: Math.min(92, ovr + 28),
    peakOvr: ovr,
    photoAssetId: null,
    status: { fitness: 100, morale: 75, condition: 75, sharpness: 50, injuryId: null, yellowCards: 0, suspendedMatches: 0 },
    externalCareer: null,
    honours: [],
    meta: { sourceType: 'test', source: 'generated:user-player', sourceUpdatedAt: startDate, licenseStatus: 'none', createdAt: startDate, updatedAt: startDate },
    attributesSource: 'estimated',
    appearance: input.appearance ?? generateAppearance(id),
  };
}

export function playerState(w: Pick<WorldState, 'mode' | 'modeState'>): PlayerModeState | null {
  return w.mode === 'player' && w.modeState?.kind === 'player' ? w.modeState : null;
}

export function userPlayerOf(w: WorldState): Player | null {
  const st = playerState(w);
  return st ? w.players[st.userPlayerId] ?? null : null;
}
