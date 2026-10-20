# Changelog

## [0.1.0] - 2026-10-20

서버사이드 PNG 차트 렌더링 B2B 시각화 프로토타입의 첫 릴리스. 서버를 브라우저 안(MSW + PGlite + Web Worker)에서 돌려 유지비 없이 정적 호스팅으로 배포할 수 있다.

### 구조
- 브라우저 내 "서버": MSW REST handler → Job Manager → DB Worker(PGlite) / Render Worker pool(OffscreenCanvas), PNG는 Cache API에 보관하고 `<img src>` 요청도 MSW가 응답 (#1~#3)
- Next.js static export, 화면은 원본과 같은 `data?.url && <img src width height>` 형태 유지

### 데이터
- 시드 기반 제조/IoT 센서 데이터 절차적 생성 (10만 / 50만 / 100만 행), COPY 적재, IndexedDB 영속화 (#1)
- bar/boxplot 집계는 PGlite SQL (GROUP BY, percentile_cont, 1.5 IQR) (#7)

### 차트와 상호작용
- scatter / bar(통계 함수 6종) / boxplot (#2, #7)
- split by 다중 선택(클릭 순서 보장, 구분 기호), 30,000개 제한, n×n grid pagination과 스크롤 페이지 이동 (#4)
- 렌더 job: 단계별 진행률, long polling, 취소, `draw → pending → cancel` (#3)
- metadata 기반 툴팁(첫 hover에만 조회, 이후 서버 호출 없이 좌표·가장 가까운 점), 추가 컬럼 서버 조회, 차트별 strategy pattern (#5)
- 확대/축소/초기화, 데이터 좌표 도형(사각형·선·자유곡선·텍스트), undo / 전체 삭제 (#6)
- 공통 속성(전체 다시 그리기, 개별 속성 덮어쓰기)과 item 개별 색상 (#8)
- legend: 범주 컬럼별 색, PNG 안 legend 상자의 ●로 item별 색 변경(color picker 최종 색으로 요청), legend별 공통 색 (#13)
- resize 300ms 뒤 현재 페이지만 다시 그리기, grid 크기 즉시 반영 (#9)
- 툴팁 portal, bar/boxplot 감싸는 사각형 hover (#14)

### history
- draw마다 1건 + 이후 변경 덧붙임, 썸네일, 복원, lz-string URL 공유 (#10)

### 수정
- 페이지 polling이 먼저 멈춰 job 종료를 놓치던 문제 (#9)
- resize 다시 그리기가 요청 실패·409·polling 실패 후 조용히 멈추던 문제 (#12)

### 알려진 제약
- "서버" 상태는 브라우저 메모리에 있어 새로고침 후에는 history에서 복원한다.
- PGlite `relaxedDurability`로 기록 직후 아주 빠르게 탭을 닫으면 마지막 기록이 남지 않을 수 있다.
- 고해상도(레티나) 대응, 도형 수정, redo, 색 외 개별 속성, item legend 개별 색 되돌리기 버튼은 범위 밖이다.
