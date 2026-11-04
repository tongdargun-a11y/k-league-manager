/**
 * 선수 데이터 CSV/JSON 가져오기.
 * 사용자가 적법하게 확보한 데이터를 새 게임용 '데이터셋'으로 만든다.
 * 이미 진행 중인 세이브는 바꾸지 않는다 (세이브는 생성 시점의 선수 스냅샷을 가진다).
 */
import type { AttributeKey, Club, Foot, Player, PlayerAttributes, Position } from '../../types';
import { POSITIONS } from '../../types';
import { clamp, ovrForPosition } from '../ratings/ovr';
import { createRng, hashString } from '../../utils/rng';
import { koreanizeName } from '../../data/testPlayers';
import { HOME_NATION } from '../../data';

export interface ImportIssue {
  row: number; // 1부터 (헤더 제외한 데이터 행 번호)
  field: string;
  message: string;
  level: 'error' | 'warning';
}

export interface ImportResult {
  players: Player[];
  issues: ImportIssue[];
  totalRows: number;
  /** 구단별 가져온 선수 수 */
  perClub: Record<string, number>;
}

export interface PlayerDataset {
  id: string;
  name: string;
  fileName: string;
  importedAt: string;
  players: Player[];
}

const ATTRIBUTE_KEYS: AttributeKey[] = [
  'finishing', 'shooting', 'offPositioning', 'heading', 'shortPassing', 'longPassing', 'vision', 'crossing',
  'tackling', 'marking', 'defPositioning', 'interceptions', 'pace', 'acceleration', 'stamina', 'strength', 'jumping',
  'decisions', 'composure', 'leadership', 'aggression', 'teamwork', 'reflexes', 'handling', 'gkPositioning',
];

/** 한글·영문 헤더 별칭 → 표준 필드 */
const HEADER_ALIASES: Record<string, string> = {
  id: 'id', 선수id: 'id', playerid: 'id',
  name: 'name', 이름: 'name', 선수명: 'name',
  nameen: 'nameEn', 영문이름: 'nameEn',
  clubid: 'clubId', club: 'clubId', 구단: 'clubId', 구단id: 'clubId', 소속: 'clubId',
  position: 'position', positions: 'position', 포지션: 'position',
  nationality: 'nationality', 국적: 'nationality',
  birthdate: 'birthDate', 생년월일: 'birthDate',
  age: 'age', 나이: 'age',
  shirtnumber: 'shirtNumber', number: 'shirtNumber', 등번호: 'shirtNumber',
  heightcm: 'heightCm', height: 'heightCm', 키: 'heightCm', 신장: 'heightCm',
  weightkg: 'weightKg', weight: 'weightKg', 몸무게: 'weightKg', 체중: 'weightKg',
  foot: 'foot', 주발: 'foot',
  ovr: 'ovr', overall: 'ovr', 능력치: 'ovr',
  potential: 'potential', pot: 'potential', 잠재력: 'potential',
  contractend: 'contractEnd', 계약만료: 'contractEnd',
  wage: 'wage', 주급: 'wage',
  apps: 'apps', appearances: 'apps', 출전: 'apps', 통산출전: 'apps',
  goals: 'goals', 득점: 'goals', 통산득점: 'goals',
  assists: 'assists', 도움: 'assists', 통산도움: 'assists',
  source: 'source', 출처: 'source',
  sourceupdatedat: 'sourceUpdatedAt', 기준일: 'sourceUpdatedAt',
};
for (const k of ATTRIBUTE_KEYS) HEADER_ALIASES[k.toLowerCase()] = k;

const POSITION_ALIASES: Record<string, Position> = {
  GK: 'GK', G: 'GK', 골키퍼: 'GK',
  CB: 'CB', DC: 'CB', DF: 'CB', D: 'CB', 센터백: 'CB', 수비수: 'CB',
  LB: 'LB', LWB: 'LB', 왼쪽풀백: 'LB',
  RB: 'RB', RWB: 'RB', 오른쪽풀백: 'RB',
  DM: 'DM', CDM: 'DM', DMF: 'DM', 수비형미드필더: 'DM',
  CM: 'CM', MF: 'CM', M: 'CM', 미드필더: 'CM',
  AM: 'AM', CAM: 'AM', SS: 'AM', 공격형미드필더: 'AM',
  LM: 'LM', RM: 'RM', LW: 'LW', LF: 'LW', RW: 'RW', RF: 'RW',
  ST: 'ST', CF: 'ST', FW: 'ST', F: 'ST', 공격수: 'ST', 스트라이커: 'ST',
};

export function normalizePosition(raw: string): Position | null {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '');
  return POSITION_ALIASES[key] ?? POSITION_ALIASES[raw.trim().replace(/\s+/g, '')] ?? ((POSITIONS as readonly string[]).includes(key) ? (key as Position) : null);
}

function normalizeFoot(raw: string): Foot | null {
  const v = raw.trim().toLowerCase();
  if (['left', 'l', '왼발', '왼쪽'].includes(v)) return 'left';
  if (['right', 'r', '오른발', '오른쪽'].includes(v)) return 'right';
  if (['both', 'b', '양발'].includes(v)) return 'both';
  return null;
}

// ───────────────────────── 파싱 ─────────────────────────

/** RFC 4180 수준의 CSV 파서 (따옴표·쉼표·줄바꿈 처리) */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** CSV 또는 JSON 텍스트 → 표준 필드명 레코드 배열 */
export function parseInput(text: string, fileName: string): { records: Record<string, string>[]; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { records: [], error: '파일이 비어 있습니다.' };
  const isJson = fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{');
  if (isJson) {
    try {
      const data = JSON.parse(trimmed);
      const list = Array.isArray(data) ? data : Array.isArray(data?.players) ? data.players : null;
      if (!list) return { records: [], error: 'JSON은 선수 배열이거나 { "players": [...] } 형태여야 합니다.' };
      return {
        records: list.map((o: Record<string, unknown>) => {
          const rec: Record<string, string> = {};
          for (const [k, v] of Object.entries(o ?? {})) {
            const std = HEADER_ALIASES[k.toLowerCase().replace(/[\s_-]/g, '')] ?? k;
            rec[std] = Array.isArray(v) ? v.join('|') : v == null ? '' : String(v);
          }
          return rec;
        }),
      };
    } catch (e) {
      return { records: [], error: `JSON 형식 오류: ${(e as Error).message}` };
    }
  }
  const rows = parseCsv(trimmed);
  if (rows.length < 2) return { records: [], error: '헤더와 최소 1개 이상의 데이터 행이 필요합니다.' };
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s_-]/g, '')] ?? h.trim());
  return {
    records: rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}

// ───────────────────────── 검증·변환 ─────────────────────────

const PROFILE_BIAS: Partial<Record<Position, Partial<Record<AttributeKey, number>>>> = {
  GK: { reflexes: 14, handling: 12, gkPositioning: 12, finishing: -35, shooting: -30, tackling: -30, crossing: -30, offPositioning: -35, marking: -30 },
};

/** OVR만 있을 때 포지션 성향에 맞춰 게임용 능력치 생성 (추정치) */
export function estimateAttributes(pos: Position, targetOvr: number, seedKey: string): PlayerAttributes {
  const rng = createRng(hashString('import:' + seedKey));
  const attrs = {} as PlayerAttributes;
  const isGK = pos === 'GK';
  for (const k of ATTRIBUTE_KEYS) {
    const gkAttr = k === 'reflexes' || k === 'handling' || k === 'gkPositioning';
    const bias = PROFILE_BIAS[pos]?.[k] ?? (gkAttr && !isGK ? -40 : 0);
    attrs[k] = clamp(Math.round(targetOvr + bias + (rng.next() - 0.5) * 14), 15, 95);
  }
  // 목표 OVR에 맞춰 평행 이동
  const delta = targetOvr - ovrForPosition(attrs, pos);
  for (const k of ATTRIBUTE_KEYS) attrs[k] = clamp(attrs[k] + delta, 15, 97);
  return attrs;
}

function toInt(v: string | undefined): number | null {
  if (v == null || v.trim() === '') return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n) : NaN;
}

export function validateAndBuild(records: Record<string, string>[], opts: { clubs: Club[]; fileName: string; today: string; seasonYear: number }): ImportResult {
  const issues: ImportIssue[] = [];
  const players: Player[] = [];
  const clubIds = new Set(opts.clubs.map((c) => c.id));
  const clubByName = new Map<string, string>();
  for (const c of opts.clubs) {
    clubByName.set(c.name.replace(/\s/g, ''), c.id);
    clubByName.set(c.shortName.replace(/\s/g, ''), c.id);
  }
  const seenIds = new Set<string>();
  const perClub: Record<string, number> = {};

  records.forEach((r, idx) => {
    const row = idx + 1;
    const err = (field: string, message: string) => issues.push({ row, field, message, level: 'error' });
    const warn = (field: string, message: string) => issues.push({ row, field, message, level: 'warning' });
    const before = issues.filter((i) => i.level === 'error').length;

    const id = (r.id ?? '').trim();
    const name = (r.name ?? '').trim();
    if (!id) err('id', '선수 ID가 없습니다.');
    else if (seenIds.has(id)) err('id', `중복된 선수 ID: ${id}`);
    if (!name) err('name', '이름이 없습니다.');

    const rawClub = (r.clubId ?? '').trim();
    const clubId = clubIds.has(rawClub) ? rawClub : clubByName.get(rawClub.replace(/\s/g, ''));
    if (!rawClub) err('clubId', '소속 구단이 없습니다.');
    else if (!clubId) err('clubId', `알 수 없는 구단: ${rawClub} (사용 가능: ${[...clubIds].join(', ')})`);

    const posRaw = (r.position ?? '').split(/[|/;·]/).map((x) => x.trim()).filter(Boolean);
    const positions: Position[] = [];
    for (const pr of posRaw) {
      const p = normalizePosition(pr);
      if (p) { if (!positions.includes(p)) positions.push(p); }
      else err('position', `알 수 없는 포지션: ${pr}`);
    }
    if (!posRaw.length) err('position', '포지션이 없습니다.');

    let birthDate = (r.birthDate ?? '').trim();
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) err('birthDate', `생년월일 형식은 YYYY-MM-DD 입니다: ${birthDate}`);
    const age = toInt(r.age);
    if (!birthDate) {
      if (age != null && !Number.isNaN(age) && age >= 15 && age <= 45) birthDate = `${opts.seasonYear - age}-07-01`;
      else { birthDate = `${opts.seasonYear - 25}-07-01`; warn('birthDate', '생년월일·나이가 없어 25세로 가정했습니다.'); }
    }

    const checkRange = (field: string, v: number | null, min: number, max: number) => {
      if (v == null) return null;
      if (Number.isNaN(v) || v < min || v > max) { err(field, `${field} 값은 ${min}~${max} 사이 숫자여야 합니다.`); return null; }
      return v;
    };
    const shirt = checkRange('shirtNumber', toInt(r.shirtNumber), 1, 99);
    const height = checkRange('heightCm', toInt(r.heightCm), 140, 220);
    const weight = checkRange('weightKg', toInt(r.weightKg), 40, 130);
    const ovrIn = checkRange('ovr', toInt(r.ovr), 1, 99);
    const potIn = checkRange('potential', toInt(r.potential), 1, 99);
    const wage = checkRange('wage', toInt(r.wage), 0, 100000);
    const apps = checkRange('apps', toInt(r.apps), 0, 2000);
    const goals = checkRange('goals', toInt(r.goals), 0, 2000);
    const assists = checkRange('assists', toInt(r.assists), 0, 2000);

    // 능력치 열
    const attrIn: Partial<PlayerAttributes> = {};
    let attrCount = 0;
    for (const k of ATTRIBUTE_KEYS) {
      const v = checkRange(k, toInt(r[k]), 1, 99);
      if (v != null) { attrIn[k] = v; attrCount++; }
    }
    let foot: Foot = 'right';
    if (r.foot) {
      const f = normalizeFoot(r.foot);
      if (f) foot = f; else warn('foot', `주발 값을 알 수 없어 오른발로 설정: ${r.foot}`);
    }
    let contractEnd = (r.contractEnd ?? '').trim();
    if (contractEnd && /^\d{4}$/.test(contractEnd)) contractEnd = `${contractEnd}-12-31`;
    if (contractEnd && !/^\d{4}-\d{2}-\d{2}$/.test(contractEnd)) { err('contractEnd', '계약 만료일 형식은 YYYY-MM-DD 또는 YYYY 입니다.'); contractEnd = ''; }

    if (issues.filter((i) => i.level === 'error').length > before || !clubId || !positions.length) return;
    seenIds.add(id);

    const primary = positions[0];
    let attributes: PlayerAttributes;
    let attributesSource: Player['attributesSource'] = 'estimated';
    if (attrCount === ATTRIBUTE_KEYS.length) {
      attributes = attrIn as PlayerAttributes;
      attributesSource = 'imported';
    } else {
      const target = ovrIn ?? 60;
      if (ovrIn == null) warn('ovr', 'OVR·능력치가 없어 60으로 추정했습니다.');
      attributes = { ...estimateAttributes(primary, target, id), ...attrIn };
      if (attrCount > 0) warn('attributes', `능력치 ${attrCount}개만 있어 나머지는 추정했습니다.`);
    }
    const ovr = ovrForPosition(attributes, primary);
    const source = (r.source ?? '').trim() || `file:${opts.fileName}`;
    const sourceUpdatedAt = (r.sourceUpdatedAt ?? '').trim() || opts.today;
    perClub[clubId] = (perClub[clubId] ?? 0) + 1;

    // 화면에는 한글 이름만 노출: 영문 이름은 아는 단어를 한글로 바꾸고, 원문은 nameEn에 보관
    const hasHangul = /[가-힣]/.test(name);
    const displayName = hasHangul ? name : koreanizeName(name);
    if (!/[가-힣]/.test(displayName)) warn('name', `'${name}': 한글 표기를 찾지 못했습니다. 한글 이름으로 입력해 주세요.`);

    players.push({
      id: `imp-${id}`,
      name: displayName,
      nameEn: r.nameEn || (hasHangul ? undefined : name),
      nationality: (r.nationality ?? '').trim() || HOME_NATION,
      birthDate,
      heightCm: height ?? undefined,
      weightKg: weight ?? undefined,
      positions,
      foot,
      shirtNumber: shirt ?? 0,
      clubId,
      contract: {
        startDate: `${opts.seasonYear}-01-01`,
        endDate: contractEnd || `${opts.seasonYear + 1}-12-31`,
        wage: wage ?? Math.round((Math.max(0, ovr - 40) ** 2) * 1.6 + 60),
      },
      attributes,
      attributesSource,
      potential: Math.max(ovr, potIn ?? ovr + 3),
      peakOvr: ovr,
      photoAssetId: null,
      status: { fitness: 100, condition: 70, morale: 70, sharpness: 70, injuryId: null, yellowCards: 0, suspendedMatches: 0 },
      externalCareer: apps != null || goals != null || assists != null
        ? { appearances: apps ?? 0, goals: goals ?? 0, assists: assists ?? 0, source, sourceUpdatedAt }
        : null,
      honours: [],
      meta: { sourceType: 'user-import', source, sourceUpdatedAt, licenseStatus: 'unverified', createdAt: opts.today, updatedAt: opts.today },
    });
  });

  // 등번호 중복(구단 내) 정리는 새 게임 생성 시 처리
  for (const [clubId, n] of Object.entries(perClub)) {
    if (n < 22) issues.push({ row: 0, field: 'clubId', level: 'warning', message: `${clubId}: 가져온 선수가 ${n}명이라 22명이 될 때까지 테스트 선수로 채웁니다.` });
  }
  return { players, issues, totalRows: records.length, perClub };
}

export const CSV_TEMPLATE = [
  'id,name,clubId,position,nationality,birthDate,shirtNumber,heightCm,foot,ovr,potential,contractEnd,apps,goals,assists,source,sourceUpdatedAt',
  'sample-001,홍길동,stormhaven,ST|LW,솔레아,1998-03-15,9,182,right,72,75,2027,120,35,12,직접 입력,2026-11-03',
  'sample-002,김수비,lumina,CB,솔레아,1995-07-02,4,188,right,68,68,2026-12-31,,,,직접 입력,2026-11-03',
].join('\n');
