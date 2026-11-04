// ─────────────────────────────────────────────────────────────
// Virtual Football Manager 핵심 타입 정의
// 모든 엔티티는 안정적인 id를 사용하며 이름을 키로 쓰지 않는다.
// ─────────────────────────────────────────────────────────────

/** ISO 날짜 문자열 (YYYY-MM-DD). 게임 내 날짜이며 실제 시스템 시간과 무관하다. */
export type GameDate = string;

/** 데이터 출처 구분 */
export type SourceType = 'official' | 'licensed' | 'user-import' | 'test';

/** 사진·엠블럼 등의 사용 권한 상태 */
export type LicenseStatus = 'verified' | 'personal-use' | 'unverified' | 'none';

export interface DataSourceMeta {
  sourceType: SourceType;
  /** 출처 URL 또는 식별자 */
  source: string;
  sourceUpdatedAt: string;
  licenseStatus: LicenseStatus;
  createdAt: string;
  updatedAt: string;
}

export const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW';

export type Foot = 'left' | 'right' | 'both';

/** 능력치 (1~100). 공식 데이터가 아니면 게임용 추정치다. */
export interface PlayerAttributes {
  // 공격
  finishing: number;
  shooting: number;
  offPositioning: number;
  heading: number;
  // 패스
  shortPassing: number;
  longPassing: number;
  vision: number;
  crossing: number;
  // 수비
  tackling: number;
  marking: number;
  defPositioning: number;
  interceptions: number;
  // 피지컬
  pace: number;
  acceleration: number;
  stamina: number;
  strength: number;
  jumping: number;
  // 정신
  decisions: number;
  composure: number;
  leadership: number;
  aggression: number;
  teamwork: number;
  // 골키퍼
  reflexes: number;
  handling: number;
  gkPositioning: number;
}

export type AttributeKey = keyof PlayerAttributes;

/** 경기 컨디션 관련 가변 상태 */
export interface PlayerStatus {
  /** 체력 0~100 */
  fitness: number;
  /** 컨디션(폼) 0~100 */
  condition: number;
  /** 사기 0~100 */
  morale: number;
  /** 경기 감각 0~100 */
  sharpness: number;
  injuryId: string | null;
  yellowCards: number;
  suspendedMatches: number;
}

export interface Contract {
  startDate: GameDate;
  endDate: GameDate;
  /** 주급 (만원) - 게임용 */
  wage: number;
}

/** 외부(실제) 통산 기록. 출처가 없으면 null */
export interface ExternalCareerRecord {
  appearances: number;
  goals: number;
  assists: number;
  source: string;
  sourceUpdatedAt: string;
}

export interface Honour {
  id: string;
  title: string;
  seasonLabel: string;
  /** 'game' = 이 세이브에서 획득, 'real' = 실제 기록 */
  origin: 'game' | 'real';
}

export interface Player {
  id: string;
  name: string;
  nameEn?: string;
  nationality: string;
  birthDate: GameDate;
  heightCm?: number;
  weightKg?: number;
  positions: Position[]; // [주 포지션, ...보조]
  foot: Foot;
  shirtNumber: number;
  clubId: string;
  contract: Contract;
  attributes: PlayerAttributes;
  /** 잠재력 (게임 시스템 값) */
  potential: number;
  /** 게임에서 기록된 최고 OVR */
  peakOvr: number;
  photoAssetId: string | null;
  status: PlayerStatus;
  externalCareer: ExternalCareerRecord | null;
  honours: Honour[];
  meta: DataSourceMeta;
  /** 게임 내 수정 사항(이적 등) 표시 */
  gameOverride?: Partial<Pick<Player, 'clubId' | 'shirtNumber'>>;
  /** 능력치 출처: 가져온 값인지 게임이 추정한 값인지 */
  attributesSource?: 'imported' | 'estimated';
  /** 개인 훈련 집중 분야 (없으면 팀 훈련을 따름) */
  trainingFocus?: TrainingFocus | null;
}

/** 무소속 선수의 clubId */
export const FREE_AGENT = 'free';
/** 은퇴한 선수의 clubId */
export const RETIRED = 'retired';

export interface PlayerSeasonStats {
  playerId: string;
  seasonId: string;
  clubId: string;
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ratingSum: number;
  ratingCount: number;
  cleanSheets: number;
}

/** 게임 세이브 안에서 누적된 통산 기록(시즌별 합) */
export interface PlayerCareerStats {
  playerId: string;
  appearances: number;
  goals: number;
  assists: number;
  averageRating: number | null;
  seasons: PlayerSeasonStats[];
  honours: Honour[];
}

export interface ClubColors {
  primary: string;
  secondary: string;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stadium: string;
  founded?: number;
  reputation: number;
  colors: ClubColors;
  crestAssetId: string | null;
  // ── 가상 세계관 설정 (PHASE 0, 모두 선택 필드: 구버전 세이브에는 없음) ──
  nickname?: string;
  capacity?: number;
  financeTier?: 'S' | 'A' | 'B' | 'C' | 'D';
  fanBase?: number;
  emblemConcept?: string;
  kitConcept?: string;
  history?: string;
  finances: {
    balance: number;
    transferBudget: number;
    wageBudget: number;
  };
  meta: DataSourceMeta;
}

export interface ManagerRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  trophies: number;
}

export interface Manager {
  id: string;
  name: string;
  nationality: string;
  age?: number;
  tacticalStyle: 'balanced' | 'attacking' | 'defensive';
  reputation: number;
  careerStartDate: GameDate;
  clubHistory: { clubId: string; from: GameDate; to: GameDate | null }[];
  record: ManagerRecord;
}

export type TiebreakerRule = 'goalDifference' | 'goalsFor' | 'wins' | 'headToHead' | 'name';

/** 대회 규칙. 특정 시즌 규칙을 코드에 고정하지 않기 위한 설정 데이터 */
export interface CompetitionFormat {
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  /** 같은 상대와 몇 번 만나는가 (3 = 33라운드, 12팀 기준) */
  roundRobinCycles: number;
  /** 경기 요일 (0=일 ~ 6=토) */
  matchWeekday: number;
  daysBetweenRounds: number;
  tiebreakers: TiebreakerRule[];
  maxSubstitutions: number;
  maxSubstitutionWindows: number;
  benchSize: number;
  yellowCardsForSuspension: number;
  transferWindows: TransferWindow[];
  /** 1군 등록 최소/최대 인원 */
  minSquadSize: number;
  maxSquadSize: number;
  maxForeignPlayers: number;
  description: string;
}

export interface Competition {
  id: string;
  name: string;
  shortName: string;
  format: CompetitionFormat;
}

export interface Season {
  id: string;
  competitionId: string;
  label: string;
  startDate: GameDate;
  endDate: GameDate;
  status: 'upcoming' | 'active' | 'finished';
  clubIds: string[];
  /** 일정이 공식 데이터인지 테스트용인지 */
  scheduleSource: SourceType;
}

export type FixtureStatus = 'scheduled' | 'live' | 'played';

export interface FixtureResult {
  homeGoals: number;
  awayGoals: number;
}

export interface Fixture {
  id: string;
  seasonId: string;
  competitionId: string;
  round: number;
  date: GameDate;
  homeClubId: string;
  awayClubId: string;
  status: FixtureStatus;
  result: FixtureResult | null;
  /** 경기 난수 시드 (재현용) */
  seed: number | null;
}

export type MatchEventType =
  | 'kickoff'
  | 'halftime'
  | 'second-half'
  | 'fulltime'
  | 'goal'
  | 'shot'
  | 'shot-on-target'
  | 'save'
  | 'foul'
  | 'yellow'
  | 'red'
  | 'injury'
  | 'substitution'
  | 'tactic-change'
  | 'chance'
  | 'info';

export interface MatchEvent {
  id: string;
  matchId: string;
  minute: number;
  type: MatchEventType;
  clubId: string | null;
  playerId: string | null;
  relatedPlayerId: string | null;
  text: string;
}

export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-4-3' | '3-5-2' | '4-1-4-1';

export type Level3 = 'low' | 'medium' | 'high';

export interface Tactic {
  formation: Formation;
  mentality: 'defensive' | 'balanced' | 'attacking';
  pressing: Level3;
  defensiveLine: Level3;
  tempo: 'slow' | 'normal' | 'fast';
  passing: 'short' | 'mixed' | 'direct';
  attackFocus: 'central' | 'wide' | 'mixed';
  counterAttack: boolean;
  transition: 'counter-press' | 'regroup';
}

export interface Lineup {
  formation: Formation;
  /** 포메이션 슬롯 순서대로 11명의 선수 id */
  starters: string[];
  bench: string[];
  captainId: string | null;
}

export interface Injury {
  id: string;
  playerId: string;
  type: string;
  startDate: GameDate;
  expectedReturnDate: GameDate;
}

export interface PlayerMatchStats {
  playerId: string;
  clubId: string;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  fouls: number;
  yellow: number;
  red: boolean;
  rating: number;
  started: boolean;
}

export interface TeamMatchStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  possession: number;
  passesAttempted: number;
  passesCompleted: number;
  fouls: number;
  yellows: number;
  reds: number;
}

export interface MatchReport {
  fixtureId: string;
  seed: number;
  home: TeamMatchStats;
  away: TeamMatchStats;
  players: PlayerMatchStats[];
  /** 사용자 경기만 전체 이벤트를 저장, 그 외에는 득점 이벤트만 */
  events: MatchEvent[];
  momPlayerId: string | null;
}

export type NotificationKind = 'match' | 'injury' | 'info' | 'result' | 'suspension' | 'season';

export interface InboxItem {
  id: string;
  date: GameDate;
  kind: NotificationKind;
  title: string;
  body: string;
  read: boolean;
}

export type ClockSpeed = 'paused' | 'normal' | 'fast' | 'veryFast';

export interface GameClock {
  gameDate: GameDate;
  lastProcessedDate: GameDate;
  /** 처리된 날짜 이벤트 키 (멱등성 보장) */
  processedEventIds: string[];
}

// ───────────── PHASE 2: 재정·이적·계약·훈련 ─────────────

export type FinanceCategory =
  | 'gate' | 'broadcast' | 'sponsor' | 'prize' | 'transfer-in'
  | 'wages' | 'operations' | 'transfer-out' | 'compensation';

export interface FinanceTx {
  id: string;
  date: GameDate;
  clubId: string;
  category: FinanceCategory;
  /** 만원 단위. 수입은 +, 지출은 - */
  amount: number;
  note: string;
}

export interface TransferWindow {
  /** MM-DD */
  start: string;
  end: string;
  label: string;
}

export interface Transfer {
  id: string;
  playerId: string;
  fromClubId: string;
  toClubId: string;
  fee: number;
  date: GameDate;
  type: 'transfer' | 'free' | 'release' | 'contract-expired';
}

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'completed' | 'expired';

/** 다른 구단이 사용자 선수에게 보낸 이적 제안 */
export interface IncomingOffer {
  id: string;
  playerId: string;
  fromClubId: string;
  fee: number;
  date: GameDate;
  expiresOn: GameDate;
  status: OfferStatus;
}

export type TrainingFocus = 'balanced' | 'attack' | 'defense' | 'passing' | 'physical' | 'rest';
export type TrainingIntensity = 'low' | 'normal' | 'high';

export interface TrainingPlan {
  focus: TrainingFocus;
  intensity: TrainingIntensity;
}

export interface TrainingReportEntry {
  playerId: string;
  ovrBefore: number;
  ovrAfter: number;
  changed: { key: AttributeKey; delta: number }[];
}

export interface TrainingReport {
  date: GameDate;
  entries: TrainingReportEntry[];
}

/** 플레이 모드. 없으면 기존 방식(classic) */
export type GameMode = 'club' | 'manager' | 'player';

export interface WorldState {
  /** 플레이 모드 (PHASE 1~). 세이브마다 독립 */
  mode?: GameMode;
  /** 새 게임마다 만드는 월드 식별자 (추적·표시용) */
  worldId?: string;
  competition: Competition;
  season: Season;
  clubs: Record<string, Club>;
  players: Record<string, Player>;
  fixtures: Fixture[];
  reports: Record<string, MatchReport>;
  seasonStats: Record<string, PlayerSeasonStats>;
  injuries: Injury[];
  tactics: Record<string, Tactic>;
  userLineup: Lineup;
  manager: Manager;
  userClubId: string;
  clock: GameClock;
  inbox: InboxItem[];
  /** 전역 난수 시드 */
  worldSeed: number;
  finance: { ledger: FinanceTx[] };
  transfers: Transfer[];
  incomingOffers: IncomingOffer[];
  /** 구단별 팀 훈련 계획 (없으면 기본값) */
  training: Record<string, TrainingPlan>;
  trainingReports: TrainingReport[];
  /** 진행 중인 사용자 경기 (킥오프·하프타임에 저장되어 새로고침 후 이어서 진행) */
  liveMatch: import('../engine/match/engine').MatchState | null;
  /** 지난 시즌 결산 기록 (오래된 순) */
  history: SeasonRecord[];
}

export interface SeasonRecord {
  seasonId: string;
  label: string;
  championId: string;
  userClubId: string;
  userRank: number;
  table: { clubId: string; rank: number; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }[];
  topScorer: { playerId: string; name: string; clubId: string; value: number } | null;
  topAssister: { playerId: string; name: string; clubId: string; value: number } | null;
}

export interface SaveGame {
  id: string;
  schemaVersion: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  gameDate: GameDate;
  managerName: string;
  selectedClubId: string;
  /** world.mode 복사 (목록 표시용) */
  mode?: GameMode;
  world: WorldState;
}

/** 세이브 목록용 요약 (world 없이) */
/** 목록 표시용 구단 정보 (세이브 안의 구단에서 복사, 현재 게임 데이터와 무관) */
export type SaveClubInfo = Pick<Club, 'id' | 'name' | 'shortName' | 'colors'> & { founded?: number };

/** 세이브 목록용 요약 (world 없이). club은 PHASE 0 이후 저장분에만 있다. */
export type SaveSummary = Omit<SaveGame, 'world'> & { club?: SaveClubInfo };

export interface AssetMetadata {
  id: string;
  path: string;
  type: 'player-photo' | 'club-crest' | 'placeholder';
  source: string;
  license: string;
  permissionStatus: LicenseStatus;
  attribution: string;
  checkedAt: string;
}
