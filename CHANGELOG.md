# Changelog

## [0.2.0] - 2026-10-20

화면 구조를 개편하고, 원본처럼 서버를 MSA(auth · data · chart)로 나눠 code-first OAS로 화면 API 타입을 생성한다.

### 구조
- FSD를 참고한 폴더 구조(`src/{application,views,widgets,features,entities,shared}`). `app/`에는 Next.js 라우트만 둔다 (#16)
- 브라우저 안 서버를 auth(`/api/auth`) · data(`/api/data`) · chart(`/api/chart`) 서비스로 분리하고, MSW는 Hono gateway에 요청을 넘긴다. chart → data 적재 요청은 서비스 토큰으로 한다 (#17)
- code-first OAS: 서비스 zod 스키마가 요청 검증과 OpenAPI 3.1 문서(`public/openapi/*.json`)를 만들고, `pnpm gen:api`로 TS 타입을 생성한다. 화면은 openapi-fetch client로만 API를 부르고 `@server/*` import는 lint로 막는다 (#17)

### 인증
- 로그인 화면, ES256 JWT access token(5분) + refresh token rotation, 로그아웃 (#17)
- data · chart 서비스는 JWKS로 토큰을 검증하고 scope를 확인한다. 화면은 만료 전 미리 refresh하고, 401이면 refresh 후 한 번 다시 보낸다 (#17)

### 화면
- 상단 `[data] [gallery] [history]`. data는 데이터 등록 팝업(mock 생성), history는 그린 차트를 보기 전용으로 다시 보고 'gallery에서 편집'으로 가져간다 (#16)
- 모달 팝업은 overlay-kit으로 본문 상태와 분리 (#16)
- 모드 바와 item 툴바를 아이콘(lucide)으로 (#16)
- grid 크기를 Excel 표 삽입식 popover에서 행 × 열로 고른다. 직사각형 grid 지원 (#16, #18)
- 공통 속성 · draw 버튼을 왼쪽 패널 하단에 고정 (#16)
- split by / tooltip: 순서 다중 선택(Base UI Combobox + 가상 스크롤), 누른 채 끌면 지나간 순서대로 선택. React Aria와 같은 시나리오로 비교한 뒤 채택(`docs/select-library-comparison.md`). 고른 값은 한 줄에 순서대로 쉼표로 이어 보여준다 (#16, #18)
- 단일 선택(데이터, x, y, legend, 통계 함수)을 다중 선택과 같은 모양으로 통일 (#18)
- 다크 모드: 화면 색을 모두 토큰으로 바꾸고 다크 값을 둔다. 차트 PNG 위 표시는 밝은 PNG에 맞춰 고정 색을 쓴다 (#17)

### 수정
- draw가 데이터 적재를 대신 시작해도 왼쪽 데이터 select에 '미등록'이 남던 문제 (#17)
- jose를 출시 후 최소 경과 기간 정책 예외 없이 쓰도록 6.2.12로 고정 (#17)

### 알려진 제약
- refresh token은 localStorage에 둔다. 브라우저 안 mock 서버라 httpOnly 쿠키를 쓸 수 없다.
- `<img src>`는 인증 헤더를 보낼 수 없어 PNG는 추측할 수 없는 chartId URL로 인증 없이 연다.
- 공통 속성 popover가 하단 고정 버튼 아래로 열려 화면 밖으로 잘린다.
- 다크 모드에서도 서버가 그린 차트 PNG는 밝은 테마다.

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
