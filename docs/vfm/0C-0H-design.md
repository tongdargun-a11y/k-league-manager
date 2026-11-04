# 0-C · 0-G · 0-D · 0-E · 0-H 설계 (제안)

> 문서만 작성. 코드 변경 없음. 원칙: 기존 타입을 재사용하고, 새 필드는 **모두 선택(optional)** 으로 추가해 구버전 세이브가 그대로 열리게 한다.

## 0-C. 공통 데이터 모델

| 요청 모델 | 결정 | 근거 |
|---|---|---|
| World | 기존 `WorldState` 그대로 사용 (세이브마다 1개 사본) | 이미 리그·구단·선수·일정·기록을 모두 담음 |
| League | 기존 `Competition` + `CompetitionFormat` 재사용 (새 타입 안 만듦) | 12팀·회전 수·승점·이적시장이 이미 설정값 |
| Club | 기존 `Club` + 선택 필드 | 아래 표 |
| Player | 기존 `Player` + `appearance?` 1개 | 25개 능력치·12개 포지션·계약·체력·컨디션·부상·국적·주발·키/몸무게가 이미 있음 |
| Manager | 기존 `Manager` 재사용 | 이름·스타일·명성·구단 이력·전적이 이미 있음 |
| PlayerCareer | 기존 `PlayerCareerStats`(시즌 기록 합산) 재사용 + 은퇴 카드만 추가 | 중복 저장 방지 |
| ManagerCareer | `Manager.clubHistory`에 구간별 전적(선택) 추가 | 별도 테이블 불필요 |
| ClubManagement | 구단운영 모드 상태로만 둠 (`modeState`) | 다른 모드에서 쓰지 않음 |
| SaveGame / SaveSummary | `mode?`, `worldId?` 추가 (0-E) | |

**Club 선택 필드**: `nickname`, `capacity`, `financeTier('S'~'D')`, `fanBase`, `kit {pattern, primary, secondary}`, `emblemConcept`, `history`, `crestPath`. `city`는 연고 지역, `stadium`·`founded`·`reputation`·`colors`는 기존 필드 그대로.
재정 금액은 지금 계산식(명성·주급) 유지 + `financeTier` 배율(S 1.6 / A 1.3 / B 1.0 / C 0.8 / D 0.6, 조정 가능)만 곱함.

**Player**: 세부 포지션 = 기존 12종(`positions[0]`이 주 포지션), 큰 포지션(GK/DF/MF/FW)은 계산. 나이는 `birthDate`에서 계산(중복 저장 안 함). 추가는 `appearance?`(0-G)뿐.

**모드별 상태** (`WorldState.modeState?`, 하나만 존재):
- 구단운영: `{ kind:'club', facilities:{stadium, training, youth}(1~5), fanSatisfaction }`
- 감독: `{ kind:'manager', contract:{clubId, until, wage}, boardConfidence, jobOffers[] }`
- 선수: `{ kind:'player', userPlayerId, careerGoals, retirement? }` (내 선수는 `players`에 일반 선수와 같이 저장, id는 무작위)
- 없으면 = 구버전/현재 방식(구단운영+감독 혼합)

## 0-G. 픽셀 캐릭터

**방식 추천: 코드로 그리는 부품 조합 SVG** (PNG 300장 X, 스프라이트 이미지 파이프라인 X)
- 부품(얼굴형·눈·헤어·수염·체형·유니폼 무늬)을 24×32 픽셀 격자 문자열로 정의 → 색만 바꿔 SVG `<rect>`로 렌더, `shape-rendering: crispEdges`.
- 장점: 이미지 파일·라이선스 걱정 없음, 투명 배경 기본, 어떤 크기로도 선명, 구단 색이 바로 반영. 선수당 데이터 수십 바이트.
- 성능: 목록에서는 작은 크기 + 결과 캐시(같은 외형이면 재사용). 300명 동시 렌더도 가벼움. PNG가 필요하면 canvas로 내보내기 가능.

**데이터** (`Player.appearance`, 세이브의 월드 안에 저장):
`{ v:1, body:'slim'|'normal'|'stocky', skin:0~5, face:0~3, eyes:0~5, hair:0~11, hairColor:0~7, facialHair:0~3, accessory?:string }`
- 유니폼 색·무늬는 구단 `kit`, 등번호는 `shirtNumber`에서 가져옴(저장 안 함). GK는 별도 색 + 장갑.
- 생성: 선수 id 시드로 결정(같은 id면 같은 얼굴). 선수 모드는 사용자가 직접 선택.
- 확장: `v`로 형식 버전 관리, 부품 번호 추가만으로 헤어·액세서리 확장.
- 개인 이미지 기능(`images` 테이블, 실제 사진용)과 완전히 분리. 메뉴는 숨김.
- PHASE 0 범위: 데이터 구조 + 정지 이미지 1종 시제품. 애니메이션 없음.

## 0-D. 모드별 기능·권한

| 기능 | 구단운영 | 감독 | 선수 |
|---|---|---|---|
| 재정·예산·연봉 체계 | ✅ 운영 | 보기만 | ❌ |
| 영입·방출·계약 | ✅ | 영입 요청만 (구단이 결정) | 내 계약·이적 요청만 |
| 시설·유소년 | ✅ | ❌ | ❌ |
| 전술·포메이션·선발 | ❌ (AI 감독) | ✅ | ❌ |
| 경기 중 교체·전술 | ❌ (결과 보기) | ✅ 실시간 | 내 선수 시점 관전 |
| 훈련 | 방침만 | 팀 훈련 계획 | 개인 훈련 |
| 일정·순위·받은편지함 | 보기 | 보기 | 보기 |
| 진행 단위 | 날짜 진행 (공통 `advanceDay`) | 같음 | 같음 + 개인 이벤트 |

구현 방식: `MODE_CAPABILITIES[mode]` 표 하나로 메뉴 표시·라우트 접근·스토어 동작을 모두 막음. 경기 엔진·일정·재정 계산은 그대로 공유. 구단운영 모드의 선발은 기존 AI 라인업 함수 재사용.

## 0-E. 독립 세이브 구조

| 요청 필드 | 결정 |
|---|---|
| saveId | 기존 `id` 그대로 |
| mode | `SaveGame.mode?: 'club'\|'manager'\|'player'` 추가. 없으면 "기존 방식" |
| worldId | `SaveGame.worldId?` 추가(새 게임마다 무작위). 추적·표시용이며 독립성의 근거는 아님 |
| saveVersion | 기존 `schemaVersion` 그대로 (현재 v5) |
| createdAt / updatedAt | 기존 필드 그대로 |

- 독립성 근거: 세이브 1개 = DB 1행 + 월드 전체 사본, 저장은 그 행만 씀 (10장 검토 결과). 같은 선수 id가 여러 세이브에 있어도 각자 다른 월드라 문제없음.
- 세이브 스키마: 선택 필드 추가 시 v6으로 올리고 5→6은 값 변경 없는 변환. v5 이하 원본 보호 규칙은 그대로.
- **Dexie DB 버전: 올리지 않음(3 유지).** 모드별 목록은 요약에 `mode`를 넣고 화면에서 걸러도 충분(세이브 수가 적음). 인덱스가 실제로 필요해질 때만 v4로 올림.
- 목록: 모드별 구역 + 구버전 구역.

## 0-H. 호환성 검토

| 대상 | 영향 | 대응 (0-F) |
|---|---|---|
| `clubs.test.json` 실제 구단 | 새 게임 데이터 | 0-B 구단으로 교체 |
| 대회 id `kleague1`, 시즌 id `kleague1-2026` (`world.ts`, `data/index.ts`) | 새 게임만 | `spd`, `spd-2026`으로. 구버전 세이브는 자기 id 유지 |
| 테스트의 `ulsan`·`seoul`·`jeonbuk`·`pohang`·`daegu` (테스트 3개 + 0-A 테스트) | 실패함 | 새 id로 교체. 구버전 샘플 테스트는 "구버전 데이터"라 그대로 둘 수 있음 |
| `TEST_CLUBS` 직접 사용 (`NewGamePage`, `ImportPage`, `LocalImagesPage`) | 표시·검증 | 새 구단 목록으로 |
| 선수 생성기(구단 id 시드) | 새 id → 새 선수단 | 의도된 변화 |
| 가져오기: 저장된 데이터셋이 옛 구단 id 사용 | 새 게임에 매칭 안 됨 | 삭제하지 않고 "구버전 데이터셋"으로 표시·선택 불가. 안내 문구를 가상 데이터 편집용으로 |
| 개인 이미지 키 `club:<옛 id>` | 새 구단과 안 맞음 | 메뉴 숨김, 데이터 유지 |
| 타입 확장 | 모두 선택 필드 | 구버전 로딩 영향 없음 (0-I에서 재확인) |
| 마이그레이션 | 5→6 값 변경 없음 | 원본 보호 유지 |
| 백업·복구 | 형식 그대로 | 영향 없음 |
| GitHub Pages | base = 저장소 이름 | 저장소 이름을 바꾸지 않으면 영향 없음. 이름 변경은 PHASE 0 밖에서 별도 결정 |
| `package.json` 이름, 앱 제목, README·설계·Claude 지침 | 문구 | 0-F에서 새 방향으로 수정 (DB 이름 `k-league-manager`는 유지) |

## 결정 필요
1. 픽셀 방식: 코드 SVG 부품 조합(추천) / PNG 스프라이트.
2. 감독 모드 영입: "요청만"(추천) / 직접 영입.
