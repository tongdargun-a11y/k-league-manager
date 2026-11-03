import type { Formation, Position, Tactic } from '../../types';

export interface FormationSlot {
  position: Position;
  /** 경기장 좌표 (x: 0=왼쪽 ~ 100=오른쪽, y: 0=상대 골문 ~ 100=우리 골문) */
  x: number;
  y: number;
}

export const FORMATIONS: Record<Formation, FormationSlot[]> = {
  '4-4-2': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'LB', x: 15, y: 72 }, { position: 'CB', x: 38, y: 76 }, { position: 'CB', x: 62, y: 76 }, { position: 'RB', x: 85, y: 72 },
    { position: 'LM', x: 15, y: 48 }, { position: 'CM', x: 38, y: 52 }, { position: 'CM', x: 62, y: 52 }, { position: 'RM', x: 85, y: 48 },
    { position: 'ST', x: 38, y: 22 }, { position: 'ST', x: 62, y: 22 },
  ],
  '4-3-3': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'LB', x: 15, y: 72 }, { position: 'CB', x: 38, y: 76 }, { position: 'CB', x: 62, y: 76 }, { position: 'RB', x: 85, y: 72 },
    { position: 'CM', x: 30, y: 50 }, { position: 'DM', x: 50, y: 58 }, { position: 'CM', x: 70, y: 50 },
    { position: 'LW', x: 18, y: 24 }, { position: 'ST', x: 50, y: 18 }, { position: 'RW', x: 82, y: 24 },
  ],
  '4-2-3-1': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'LB', x: 15, y: 72 }, { position: 'CB', x: 38, y: 76 }, { position: 'CB', x: 62, y: 76 }, { position: 'RB', x: 85, y: 72 },
    { position: 'DM', x: 38, y: 58 }, { position: 'DM', x: 62, y: 58 },
    { position: 'LW', x: 18, y: 36 }, { position: 'AM', x: 50, y: 38 }, { position: 'RW', x: 82, y: 36 },
    { position: 'ST', x: 50, y: 16 },
  ],
  '3-4-3': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'CB', x: 28, y: 76 }, { position: 'CB', x: 50, y: 78 }, { position: 'CB', x: 72, y: 76 },
    { position: 'LM', x: 12, y: 50 }, { position: 'CM', x: 38, y: 54 }, { position: 'CM', x: 62, y: 54 }, { position: 'RM', x: 88, y: 50 },
    { position: 'LW', x: 20, y: 24 }, { position: 'ST', x: 50, y: 18 }, { position: 'RW', x: 80, y: 24 },
  ],
  '3-5-2': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'CB', x: 28, y: 76 }, { position: 'CB', x: 50, y: 78 }, { position: 'CB', x: 72, y: 76 },
    { position: 'LM', x: 10, y: 48 }, { position: 'CM', x: 32, y: 50 }, { position: 'DM', x: 50, y: 58 }, { position: 'CM', x: 68, y: 50 }, { position: 'RM', x: 90, y: 48 },
    { position: 'ST', x: 38, y: 20 }, { position: 'ST', x: 62, y: 20 },
  ],
  '4-1-4-1': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'LB', x: 15, y: 72 }, { position: 'CB', x: 38, y: 76 }, { position: 'CB', x: 62, y: 76 }, { position: 'RB', x: 85, y: 72 },
    { position: 'DM', x: 50, y: 60 },
    { position: 'LM', x: 15, y: 42 }, { position: 'CM', x: 38, y: 44 }, { position: 'CM', x: 62, y: 44 }, { position: 'RM', x: 85, y: 42 },
    { position: 'ST', x: 50, y: 18 },
  ],
};

export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

export const DEFAULT_TACTIC: Tactic = {
  formation: '4-4-2',
  mentality: 'balanced',
  pressing: 'medium',
  defensiveLine: 'medium',
  tempo: 'normal',
  passing: 'mixed',
  attackFocus: 'mixed',
  counterAttack: false,
  transition: 'regroup',
};

export interface TacticPreset {
  id: string;
  name: string;
  description: string;
  tactic: Omit<Tactic, 'formation'>;
}

export const TACTIC_PRESETS: TacticPreset[] = [
  { id: 'balanced', name: '균형', description: '기본값. 공수 밸런스를 유지합니다.',
    tactic: { mentality: 'balanced', pressing: 'medium', defensiveLine: 'medium', tempo: 'normal', passing: 'mixed', attackFocus: 'mixed', counterAttack: false, transition: 'regroup' } },
  { id: 'gegenpress', name: '전방 압박', description: '높은 압박과 빠른 템포. 체력 소모가 큽니다.',
    tactic: { mentality: 'attacking', pressing: 'high', defensiveLine: 'high', tempo: 'fast', passing: 'mixed', attackFocus: 'mixed', counterAttack: false, transition: 'counter-press' } },
  { id: 'possession', name: '점유율', description: '짧은 패스로 공을 오래 소유합니다.',
    tactic: { mentality: 'balanced', pressing: 'medium', defensiveLine: 'high', tempo: 'slow', passing: 'short', attackFocus: 'central', counterAttack: false, transition: 'counter-press' } },
  { id: 'park-bus', name: '수비 후 역습', description: '내려앉아 지키다 빠르게 역습합니다.',
    tactic: { mentality: 'defensive', pressing: 'low', defensiveLine: 'low', tempo: 'fast', passing: 'direct', attackFocus: 'wide', counterAttack: true, transition: 'regroup' } },
  { id: 'wing-play', name: '측면 공격', description: '측면 크로스 위주로 공격합니다.',
    tactic: { mentality: 'attacking', pressing: 'medium', defensiveLine: 'medium', tempo: 'normal', passing: 'mixed', attackFocus: 'wide', counterAttack: false, transition: 'regroup' } },
];

export const TACTIC_LABELS = {
  mentality: { defensive: '수비적', balanced: '균형', attacking: '공격적' },
  pressing: { low: '낮음', medium: '보통', high: '높음' },
  defensiveLine: { low: '낮음', medium: '보통', high: '높음' },
  tempo: { slow: '느림', normal: '보통', fast: '빠름' },
  passing: { short: '짧게', mixed: '혼합', direct: '직접' },
  attackFocus: { central: '중앙', wide: '측면', mixed: '혼합' },
  transition: { 'counter-press': '즉시 압박', regroup: '재정비' },
} as const;
