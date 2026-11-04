# PHASE 0 최종 보고서

기준: `phase0-start`(7e0ab0f) → 작업 브랜치 `claude/project-thread-t4c3at`, PR #7. 2026-11-04.

## 1. 완료 내용
| 단계 | 내용 | 결과 |
|---|---|---|
| 0-A1 | 전체 백업(모든 세이브 원본 + 데이터셋 + 선택 시 개인 이미지) JSON 내려받기 | 완료, 브라우저에서 실제 다운로드 확인 |
| 0-A2 | 백업 복구: 검증, 잘못된 파일 거부, 항상 새 id로 추가, 저장 후 무결성 비교 | 완료, 별도 브라우저 환경에서 복구·비교 확인 |
| 0-A3 | 구버전(v1~v4) 세이브 원본 보호: 덮어쓰기·삭제 차단, 이어하기는 새 세이브, 목록 구분 | 완료 |
| 0-B | 세계관(솔레아), 리그, 12개 구단 설계 | 문서 완료, 0-F에서 적용 |
| 0-C~0-H | 공통 모델, 픽셀 캐릭터, 모드 권한, 세이브 구조, 호환성 | 문서 완료 (구현은 PHASE 1~) |
| 0-F | 실제 K리그 데이터·문구 제거, 가상 구단 적용, 문서 정리 | 완료 |
| 0-I | 통합 검증, 선수 이름 한글 표시 | 완료 |

## 2. 파일
- **추가**: `src/repositories/backup.ts`, `backup.test.ts`, `legacy.test.ts`, `isolation.test.ts`, `src/features/backup/BackupPanel.tsx`, `src/data/clubs.json`, `docs/vfm/*`(설계·지침·로드맵·보고서), `docs/legacy/README.md`, 개발용 패키지 `fake-indexeddb`
- **수정**: `saveRepository.ts`, `migrations.ts`, `world.ts`, `types/index.ts`, `gameStore.ts`, `data/index.ts`, `testPlayers.ts`, `importPlayers.ts`, `ClubBadge.tsx`, `TestDataBadge.tsx`, `AppLayout.tsx`, `TitlePage.tsx`, `SavesPage.tsx`, `NewGamePage.tsx`, `ImportPage.tsx`, `PlayerPage.tsx`, `PlayerCard.tsx`, 기존 테스트 3개, `README.md`, `index.html`, `package.json`
- **삭제**: `src/data/clubs.test.json` (실제 구단 데이터 → `clubs.json`으로 대체)
- **이동**: 옛 설계 문서 2개 → `docs/legacy/`

## 3. 기존 기능 유지 여부
경기 엔진, 전술, 일정·순위, 이적·계약, 재정, 훈련, 시즌 넘기기, 저장·불러오기 모두 유지(기존 테스트 통과). 숨긴 것: 개인 로고·사진 메뉴와 버튼(코드 유지).

## 4. 테스트 결과 (마지막 실행)
| 항목 | 결과 |
|---|---|
| `npm test` | 71개 통과 (시작 시 41개) |
| `npx tsc -b` | 오류 없음 |
| `npm run build` / Pages용 빌드(`--base=/k-league-manager/`) | 성공 |
| ESLint | 오류 0, 경고 1 (기존 `TacticControls.tsx`) |
| 신규 게임 생성·12개 구단 표시 | 테스트 + 브라우저 확인 |
| 가상 선수 생성·이름 한글 | 테스트(12구단 전원) + 브라우저 스쿼드 화면에 영문 0 |
| 세이브 독립성(구단운영·감독·선수 조작) | 실제 변경 후 다른 세이브 DB 내용 비교 테스트 통과 |
| v1~v4 불러오기·원본 불변 | 테스트 통과 (합성 샘플) + 브라우저 확인 |
| JSON 백업·복구 | 테스트 + 브라우저 2개 환경 확인 |
| 저장 후 새로고침 | 브라우저 확인 |

## 5. 세이브 호환성
- 세이브 스키마 v5(v4 이하 = 구버전 원본, 덮어쓰기·삭제 불가). Dexie DB 버전은 3 그대로, DB 이름 `k-league-manager` 유지.
- 구버전 세이브는 자기 안의 구단 데이터로 계속 플레이 가능. 이어서 저장하면 새 세이브 "(이어하기)" 생성.
- 옛 구단 id로 만든 가져오기 데이터셋은 삭제하지 않고 새 게임 선택만 막음.

## 6. 세 가지 모드 / 픽셀 캐릭터
설계는 `docs/vfm/0C-0H-design.md`. 요약: `SaveGame.mode`·`worldId`, `WorldState.modeState`(모드별 상태 하나), `MODE_CAPABILITIES` 표로 메뉴·동작 제한. 픽셀 캐릭터는 코드로 그리는 부품 조합 SVG, `Player.appearance`에 숫자 몇 개 저장. **아직 구현되지 않음.** 선수 모드 독립성은 설계상 검토 + 엔진 조작 재현 테스트까지이며 실제 플레이 테스트는 아님.

## 7. 남은 문제와 위험
1. 선수·감독 국적이 실제 나라 이름(대한민국, 브라질 등). 가상 국가로 바꿀지 결정 필요.
2. 감독 이름은 사용자가 입력한 그대로 표시(영문 입력도 가능).
3. 가져오기의 영문 이름 한글화는 사전에 있는 단어만 바뀜(없으면 경고).
4. 구버전 테스트 샘플은 합성 데이터. 실제 사용자 세이브는 배포 전 전체 백업 권장.
5. 재정 등급·수용 인원은 데이터만 있고 아직 계산에 쓰지 않음.
6. 저장소 이름(`k-league-manager`) 변경은 배포 주소가 바뀌므로 별도 결정.

## 8. PHASE 1 계획
모드 선택 화면 → `mode`/`modeState`(스키마 v6) → `MODE_CAPABILITIES`로 메뉴·라우트·스토어 제한 → 감독 모드 분리(현재 게임 기반) → 픽셀 캐릭터 렌더러 시제품(선수 프로필) → 짧은 시즌(22라운드) 옵션 → 재정 등급 배율 적용. 상세는 `docs/vfm/ROADMAP.md`.
