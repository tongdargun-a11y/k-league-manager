import type { Club, Foot, Player, PlayerAttributes, Position } from '../types';
import { createRng, hashString, type Rng } from '../utils/rng';
import { clamp, ovrForPosition } from '../engine/ratings/ovr';

/**
 * ⚠ 테스트용 가상 선수 생성기
 * 실제 K리그 선수 데이터(이름·기록·사진)를 확보하기 전까지 사용하는 개발용 데이터다.
 * 생성되는 이름은 무작위 조합이며 실존 인물과 무관하다. 능력치는 모두 게임용 추정치다.
 * 같은 구단 id에 대해 항상 같은 선수단을 만든다(시드 고정).
 */

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '백', '허', '남', '심'];
const GIVEN_A = ['민', '서', '도', '준', '현', '지', '태', '우', '성', '재', '승', '건', '하', '시', '은', '유', '동', '진', '정', '영', '상', '형', '주', '기', '한'];
const GIVEN_B = ['준', '호', '현', '우', '민', '혁', '훈', '빈', '원', '석', '범', '수', '규', '찬', '율', '결', '온', '환', '성', '진', '오', '겸', '윤', '태', '헌'];

const FOREIGN: { nationality: string; first: string[]; last: string[] }[] = [
  { nationality: '브라질', first: ['Tiago', 'Rafael', 'Lucas', 'Matheus', 'Bruno', 'Gustavo', 'Caio', 'Diego'], last: ['Silvano', 'Moreira', 'Teixeira', 'Barreto', 'Cardoso', 'Ramalho', 'Fontes', 'Pires'] },
  { nationality: '일본', first: ['Haruto', 'Sota', 'Ren', 'Kaito', 'Yuto', 'Riku'], last: ['Morikawa', 'Takeda', 'Hirano', 'Sakamoto', 'Kimura', 'Ishida'] },
  { nationality: '호주', first: ['Liam', 'Jack', 'Noah', 'Cooper', 'Mason'], last: ['Hartley', 'Brennan', 'Walsh', 'Kerr', 'Doyle'] },
  { nationality: '세르비아', first: ['Nikola', 'Stefan', 'Marko', 'Luka'], last: ['Petrovac', 'Ilijev', 'Markoski', 'Jankov'] },
  { nationality: '콜롬비아', first: ['Andrés', 'Camilo', 'Julián', 'Sebastián'], last: ['Ospino', 'Restrepa', 'Villamar', 'Quintero'] },
];


/** 스쿼드 템플릿: 25명 */
const SQUAD_TEMPLATE: Position[][] = [
  ['GK'], ['GK'], ['GK'],
  ['CB'], ['CB'], ['CB'], ['CB', 'DM'], ['LB', 'LM'], ['LB'], ['RB', 'RM'], ['RB'],
  ['DM', 'CM'], ['DM', 'CB'], ['CM', 'DM'], ['CM', 'AM'], ['CM'], ['AM', 'CM'], ['AM', 'ST'],
  ['LM', 'LW'], ['RM', 'RW'], ['LW', 'ST'], ['RW', 'LW'],
  ['ST'], ['ST'], ['ST', 'AM'],
];

type Profile = Partial<Record<keyof PlayerAttributes, number>>;

/** 포지션별 능력치 성향 (+는 강점, -는 약점) */
const PROFILE: Record<Position, Profile> = {
  GK: { reflexes: 14, handling: 12, gkPositioning: 12, jumping: 4, finishing: -35, shooting: -30, tackling: -30, crossing: -30, offPositioning: -35, marking: -30, pace: -12 },
  CB: { tackling: 10, marking: 10, defPositioning: 10, heading: 8, strength: 8, jumping: 6, finishing: -18, crossing: -10, vision: -8, reflexes: -40, handling: -40, gkPositioning: -40 },
  LB: { pace: 6, stamina: 8, crossing: 6, tackling: 4, marking: 4, finishing: -14, heading: -4, reflexes: -40, handling: -40, gkPositioning: -40 },
  RB: { pace: 6, stamina: 8, crossing: 6, tackling: 4, marking: 4, finishing: -14, heading: -4, reflexes: -40, handling: -40, gkPositioning: -40 },
  DM: { interceptions: 9, tackling: 8, defPositioning: 7, shortPassing: 5, teamwork: 6, finishing: -10, reflexes: -40, handling: -40, gkPositioning: -40 },
  CM: { shortPassing: 8, longPassing: 6, vision: 6, stamina: 6, decisions: 5, reflexes: -40, handling: -40, gkPositioning: -40 },
  AM: { vision: 10, shortPassing: 8, shooting: 6, offPositioning: 5, composure: 4, tackling: -10, marking: -12, reflexes: -40, handling: -40, gkPositioning: -40 },
  LM: { crossing: 9, pace: 7, acceleration: 6, stamina: 6, tackling: -4, reflexes: -40, handling: -40, gkPositioning: -40 },
  RM: { crossing: 9, pace: 7, acceleration: 6, stamina: 6, tackling: -4, reflexes: -40, handling: -40, gkPositioning: -40 },
  LW: { pace: 11, acceleration: 10, crossing: 6, finishing: 5, tackling: -12, marking: -14, reflexes: -40, handling: -40, gkPositioning: -40 },
  RW: { pace: 11, acceleration: 10, crossing: 6, finishing: 5, tackling: -12, marking: -14, reflexes: -40, handling: -40, gkPositioning: -40 },
  ST: { finishing: 13, offPositioning: 11, shooting: 8, heading: 6, composure: 5, tackling: -16, marking: -18, interceptions: -12, reflexes: -40, handling: -40, gkPositioning: -40 },
};

const ATTR_KEYS: (keyof PlayerAttributes)[] = [
  'finishing', 'shooting', 'offPositioning', 'heading', 'shortPassing', 'longPassing', 'vision', 'crossing',
  'tackling', 'marking', 'defPositioning', 'interceptions', 'pace', 'acceleration', 'stamina', 'strength', 'jumping',
  'decisions', 'composure', 'leadership', 'aggression', 'teamwork', 'reflexes', 'handling', 'gkPositioning',
];

export function makeAttributes(rng: Rng, pos: Position, base: number): PlayerAttributes {
  const profile = PROFILE[pos];
  const attrs = {} as PlayerAttributes;
  for (const key of ATTR_KEYS) {
    const bias = profile[key] ?? 0;
    attrs[key] = clamp(Math.round(base + bias + (rng.next() - 0.5) * 16), 15, 95);
  }
  return attrs;
}

/** 목표 OVR에 맞도록 능력치 전체를 평행 이동 */
export function tuneToOvr(attrs: PlayerAttributes, pos: Position, target: number): PlayerAttributes {
  const current = ovrForPosition(attrs, pos);
  const delta = target - current;
  const tuned = { ...attrs };
  for (const key of ATTR_KEYS) tuned[key] = clamp(tuned[key] + delta, 15, 97);
  return tuned;
}

export function koreanName(rng: Rng): string {
  return rng.pick(SURNAMES) + rng.pick(GIVEN_A) + rng.pick(GIVEN_B);
}

/** 가상 외국인 선수 이름의 한글 표기 */
export const KO_NAME: Record<string, string> = {
  Tiago: '치아구', Rafael: '하파엘', Lucas: '루카스', Matheus: '마테우스', Bruno: '브루누', Gustavo: '구스타부', Caio: '카이우', Diego: '디에구',
  Silvano: '시우바누', Moreira: '모레이라', Teixeira: '테이셰이라', Barreto: '바헤투', Cardoso: '카르도주', Ramalho: '하말류', Fontes: '폰치스', Pires: '피리스',
  Haruto: '하루토', Sota: '소타', Ren: '렌', Kaito: '가이토', Yuto: '유토', Riku: '리쿠',
  Morikawa: '모리카와', Takeda: '다케다', Hirano: '히라노', Sakamoto: '사카모토', Kimura: '기무라', Ishida: '이시다',
  Liam: '리암', Jack: '잭', Noah: '노아', Cooper: '쿠퍼', Mason: '메이슨',
  Hartley: '하틀리', Brennan: '브레넌', Walsh: '월시', Kerr: '커', Doyle: '도일',
  Nikola: '니콜라', Stefan: '스테판', Marko: '마르코', Luka: '루카',
  Petrovac: '페트로바츠', Ilijev: '일리예프', Markoski: '마르코스키', Jankov: '얀코프',
  'Andrés': '안드레스', Camilo: '카밀로', 'Julián': '훌리안', 'Sebastián': '세바스티안',
  Ospino: '오스피노', Restrepa: '레스트레파', Villamar: '비야마르', Quintero: '킨테로',
};

/** 영문 이름 → 한글 표기 (모르는 단어는 그대로) */
export function koreanizeName(en: string): string {
  return en.split(' ').map((w) => KO_NAME[w] ?? w).join(' ');
}

function foreignName(rng: Rng): { name: string; nameEn: string; nationality: string } {
  const f = rng.pick(FOREIGN);
  const en = rng.pick(f.first) + ' ' + rng.pick(f.last);
  return { name: koreanizeName(en), nameEn: en, nationality: f.nationality };
}

export function generateTestSquad(club: Club, seasonStart: string): Player[] {
  const rng = createRng(hashString('squad:' + club.id));
  const usedNames = new Set<string>();
  const usedNumbers = new Set<number>();
  const players: Player[] = [];
  // 구단 평판 → 주전급 평균 OVR
  const teamLevel = 58 + (club.reputation - 65) * 0.5;
  const foreignSlots = new Set<number>();
  while (foreignSlots.size < 4) foreignSlots.add(rng.int(3, SQUAD_TEMPLATE.length - 1));

  SQUAD_TEMPLATE.forEach((positions, idx) => {
    const pos = positions[0];
    const isForeign = foreignSlots.has(idx);
    const tier = rng.next();
    // 핵심/주전/로테이션/유망주 분포
    let targetOvr = teamLevel + (tier < 0.2 ? 6 : tier < 0.6 ? 2 : tier < 0.85 ? -3 : -8) + (isForeign ? 4 : 0);
    if (idx === 2) targetOvr -= 8; // 3번 골키퍼
    targetOvr = clamp(Math.round(targetOvr + (rng.next() - 0.5) * 4), 45, 88);

    const age = tier > 0.85 ? rng.int(18, 21) : rng.int(21, 34);
    const birthYear = Number(seasonStart.slice(0, 4)) - age;
    const birthDate = `${birthYear}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;

    let name: string;
    let nameEn: string | undefined;
    let nationality = '대한민국';
    do {
      if (isForeign) {
        const f = foreignName(rng);
        name = f.name; nameEn = f.nameEn; nationality = f.nationality;
      } else {
        name = koreanName(rng);
      }
    } while (usedNames.has(name));
    usedNames.add(name);

    let shirt: number;
    if (pos === 'GK') shirt = [1, 21, 31][idx] ?? rng.int(30, 99);
    else {
      do { shirt = rng.int(2, 99); } while (usedNumbers.has(shirt) || [1, 21, 31].includes(shirt));
    }
    usedNumbers.add(shirt);

    const attrs = tuneToOvr(makeAttributes(rng, pos, targetOvr), pos, targetOvr);
    const ovr = ovrForPosition(attrs, pos);
    const potential = clamp(ovr + (age <= 21 ? rng.int(6, 18) : age <= 25 ? rng.int(2, 9) : rng.int(0, 3)), ovr, 94);
    const foot: Foot = pos.startsWith('L') ? 'left' : rng.chance(0.2) ? 'left' : rng.chance(0.06) ? 'both' : 'right';
    const now = '2026-11-03';

    players.push({
      id: `${club.id}-p${String(idx + 1).padStart(2, '0')}`,
      name,
      nameEn,
      nationality,
      birthDate,
      heightCm: pos === 'GK' || pos === 'CB' ? rng.int(184, 195) : rng.int(170, 188),
      weightKg: rng.int(64, 86),
      positions,
      foot,
      shirtNumber: shirt,
      clubId: club.id,
      contract: {
        startDate: `${birthYear + 18 + rng.int(0, 4)}-01-01`,
        endDate: `${Number(seasonStart.slice(0, 4)) + rng.int(0, 3)}-12-31`,
        wage: Math.round((ovr - 40) * (ovr - 40) * 1.6 + rng.int(20, 80)),
      },
      attributes: attrs,
      potential,
      peakOvr: ovr,
      photoAssetId: null,
      status: { fitness: 100, condition: rng.int(60, 80), morale: rng.int(60, 80), sharpness: 70, injuryId: null, yellowCards: 0, suspendedMatches: 0 },
      externalCareer: null,
      honours: [],
      meta: {
        sourceType: 'test',
        source: 'generated:testPlayers.ts',
        sourceUpdatedAt: now,
        licenseStatus: 'none',
        createdAt: now,
        updatedAt: now,
      },
    });
  });
  return players;
}
