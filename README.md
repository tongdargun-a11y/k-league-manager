# Virtual Football Manager (가칭)

가상의 섬나라 **솔레아**의 1부 리그 **솔레아 프리미어 디비전**(12개 구단)을 무대로 한 싱글 플레이 축구 시뮬레이션 웹 게임입니다. 귀여운 픽셀 아트, 현실적인 운영 + 캐주얼한 재미, 무료, 웹 우선 후 모바일 확장을 목표로 합니다.

- 구단·선수·지명·경기장은 **모두 가상**입니다. 실제 리그·구단·선수의 이름, 엠블럼, 사진은 쓰지 않습니다.
- 게임 시작 시 **구단운영 / 감독 / 선수** 모드 중 하나를 고르는 구조로 확장 중입니다 (PHASE 0: 설계 완료, 구현은 PHASE 1부터).
- 각 세이브는 자기만의 월드 사본을 가지며 세이브끼리 서로 영향을 주지 않습니다.

## 현재 구현된 기능
경기 엔진(실시간 경기·교체·전술 변경), 선수 능력치 25개·포지션 12종, 전술·포메이션, 일정·순위, 이적·계약, 재정, 훈련·성장, 시즌 넘기기(노화·은퇴·유소년), IndexedDB 저장·불러오기, 전체 백업·복구(JSON), 구버전 세이브 원본 보호.

## 실행
```bash
npm install
npm run dev      # 개발 서버
npm test         # 테스트
npm run build    # 타입 검사 + 빌드
```
main에 머지되면 GitHub Actions가 테스트 후 GitHub Pages로 배포합니다 (`.github/workflows/deploy.yml`).

## 기술 스택
Vite 6, React 19, TypeScript 5.8, Tailwind CSS 3, Zustand 5, React Router 7, Dexie 4 (IndexedDB), Vitest 5.

## 문서
- `docs/vfm/0B-league-and-clubs.md` — 세계관·리그·12개 구단
- `docs/vfm/0C-0H-design.md` — 데이터 모델·픽셀 캐릭터·모드 권한·세이브 구조·호환성
- `docs/vfm/CLAUDE_EXECUTION.md` — 개발(Claude) 실행 지침
- `docs/vfm/ROADMAP.md` — 개발 로드맵
- `docs/legacy/` — 구버전 문서 (현재 방향과 다름, 참고용)

## 저장 데이터 안내
세이브는 브라우저 IndexedDB(`k-league-manager` DB)에만 저장됩니다. 타이틀 화면의 **전체 백업**으로 JSON 파일을 받아 두세요. PHASE 0 이전 세이브는 "구버전"으로 표시되며 원본은 바뀌거나 삭제되지 않습니다.
