# Changelog

## [Unreleased]

### 크게 보기
- item을 더블 클릭(또는 toolbar의 크게 보기 버튼)하면 grid 자리에 그 item 하나를 크게 보여준다. 아래 `<< < 섬네일 > >>`로 한 item씩, 또는 처음·끝으로 옮기고 ←/→, Home/End, Esc도 된다
- 섬네일(128×80)은 draw 때 원래 PNG와 같은 렌더 작업에서 함께 그린다. 크기가 고정이라 resize·grid 변경에는 다시 그리지 않는다. 목록 폭이 넓을수록 섬네일이 많아진다. 크게 보는 item을 가운데 두고 한 칸씩 미끄러진다
- 큰 차트는 영역 크기 그대로 보이는 한 장만 그린다. 서버가 내용·크기별로 item당 4개까지 보관해, 오가거나 원래 크기로 돌아오면 다시 그리지 않는다
- 크게 본 item에서도 툴팁·확대·도형·색을 grid와 같이 쓴다

### item 툴바와 legend 위치
- item 상단 줄을 없애고 도구를 차트 우측 상단에 띄운다. 커서를 올리거나 포커스가 들어오면 보인다. 그만큼 PNG가 커진다
- 툴바의 설정(⚙) 팝업에서 legend 위치(위·아래·왼쪽·오른쪽)와 색을 바꾼다. 툴바의 개별 색 버튼은 이 팝업으로 옮겼다
- 전체 설정에 legend 메뉴를 추가했다. 공통 위치를 바꾸면 전체를 다시 그리고 item별 위치를 덮어쓴다
- 왼쪽·오른쪽 legend는 세로 목록으로 그린다

### 툴팁
- scatter 툴팁의 가까운 점 표시를 전체 설정 · 툴팁에서 켜고 끈다(기본 켬). 끄면 커서 위치의 x, y만 보이고 tooltip 컬럼 조회도 하지 않는다

### 로딩 표시
- 앱이 뜨는 동안 글자만 띄우던 세 화면(불러오는 중 → 서버 부팅 중 → 로그인 확인 중)을 한 부팅 화면으로 합쳐 단계와 spinner를 보여준다. 실패하면 이유와 새로고침 버튼
- history 목록, 필터 컬럼, legend 값 목록, data 팝업 상태는 받는 동안 skeleton으로 자리를 잡는다
- 차트를 여는 동안과 첫 응답 전에는 grid 모양대로 자리 표시 카드를 보여준다
- 그린 차트·history 기록·필터 컬럼이 없을 때는 아이콘과 다음 할 일을 함께 보여준다
- 로그인, draw(pending), gallery에서 편집, 링크 복사, 데이터 등록 버튼이 진행 중이면 spinner를 보인다
- 데이터 목록·컬럼을 받는 동안 '미등록', '데이터를 등록하면…'이 잘못 뜨던 것을 '확인 중', '컬럼 불러오는 중'으로 고쳤다

### 필터
- 범주 값 목록을 split by처럼 누른 채 훑어 여러 값을 한꺼번에 체크·해제한다. 체크된 값에서 시작하면 해제, 해제된 값에서 시작하면 체크. 가장자리 자동 스크롤과 Esc 되돌리기도 같다
- 드래그 선택 훅을 OrderedSelect 밖(useDragSelect)으로 빼 두 목록이 같이 쓴다

### 탭 도구 줄
- 모드 바와 링크 복사를 최상단 바에서 탭 바 아래 줄로 내렸다. 탭마다 차트가 따로라 그 탭 안의 도구로 보이게 했다
- 확대·도형 모드는 그린 차트가 없거나 history 다시 보기면 disabled로 흐리게 보인다. 차트 종류 버튼도 disabled면 흐리게 보인다

### 바뀐 동작
- 도구를 쓰지 않는 일반 모드에서는 item 위 커서가 십자 대신 기본 커서다
- item의 '공통 색 따르기'는 legend 값별 개별 색까지 모두 되돌린다

## [0.3.1] - 2026-10-21

탭이 생기면서 화면 상태가 엉뚱한 탭이나 다음 세션으로 새던 문제를 고치고, 페이지 스크롤바를 다시 만든다.

### 세션과 탭 상태
- 탭과 팝업을 로그인한 세션 범위로 묶었다. `app/(session)` route group의 layout이 로그인 확인과 세션 상태를 맡아, 로그아웃하거나 세션이 끝나면 탭·각 탭의 작업 상태·열린 팝업이 함께 사라진다. 다음 로그인에 이전 세션의 탭이 남지 않는다
- 다른 탭에서 난 오류는 지금 보는 탭 위에 띄우지 않고, 그 탭으로 돌아왔을 때 띄운다
- 탭을 오가도 draw, grid 변경, item 조작이 진행 중으로 유지돼 응답 전에 같은 요청을 다시 보내지 않는다. history나 공유 링크의 차트를 여는 동안에는 그 탭의 draw를 막는다
- 그리는 중에는 cancel하거나 끝날 때까지 탭 선택·닫기·새 탭, gallery/history 전환, data 팝업의 'gallery에서 열기'를 막는다
- 탭을 닫으면 그 탭에서 그리던 job을 취소한다
- 컬럼 라벨·타입을 앱 전체 캐시 대신 데이터셋별 스키마에서 찾는다. 스키마를 받으면 탭 이름, 툴팁, history 목록이 바로 다시 그려진다

### 고친 문제
- history를 열지 못하면 알림 없이 빈 탭이 남고, 같은 건을 다시 눌러도 불러오지 않았다. 이제 탭을 닫고 알린다. 불러오는 동안 탭 이름은 '불러오는 중…'
- 세션이 만료되면 로그인 화면의 만료 안내가 지워졌다

### 페이지 스크롤바
- 네이티브 스크롤 대신 위/아래 화살표, 트랙, thumb을 직접 그려 페이지 단위로 움직인다. 화살표는 누르고 있으면 계속 넘기고, 휠은 100px마다 한 페이지, 키보드는 ↑↓, PageUp/PageDown, Home/End
- thumb 조작이 grid 렌더에 막히지 않는다. 10×10 grid(CPU 6배 감속)에서 끌 때 프레임 p95 133~150ms → 대부분 33~67ms
- 하단 바의 상태별 개수·시간 묶음이 뒤 묶음과 겹치던 문제를 고쳤다

### 개발
- `NEXT_PUBLIC_ACCESS_TTL_SEC`, `NEXT_PUBLIC_REFRESH_TTL_SEC`로 빌드하면 토큰 수명을 줄여 세션 만료를 확인할 수 있다
- 최신 콜백을 ref에 담는 패턴을 `useCallbackRef`로 모았다

### 바뀐 동작
- 그리는 중에는 탭을 바꿀 수 없다. history 탭은 cancel 버튼이 없어 다시 그리는 중에도 바꾸거나 닫을 수 있고, 닫으면 그 job이 취소된다.

## [0.3.0] - 2026-10-20

화면을 탭 기반 작업 공간으로 개편하고, 컬럼을 코드에 고정하지 않고 적재된 데이터의 스키마에서 읽는다.

### 화면
- gallery·history 탭: 탭마다 데이터·설정·차트·진행 상태를 따로 가진다. data 팝업에서 준비된 데이터를 선택하고 'gallery에서 열기'로 새 탭, history는 고른 건마다 탭으로 연다 (#20)
- 전체 설정 팝업: 색상(공통 / legend 값별)과 split 구분 기호를 옮겼다. 하단 popover가 화면 밖으로 잘리던 문제도 함께 사라졌다 (#20)
- 페이지 이동: grid 오른쪽 페이지 스크롤바. 스크롤 중에는 보이는 페이지만 바꾸고 서버 조회는 throttle(200ms)로 줄인다. 120페이지를 한 번에 끌어도 조회는 6번 (#20)
- 하단 바: 단계, 진행률, 상태별 item 수, 경과 시간, 처리 속도, 남은 시간 어림, Render Worker 수 (#20)

### 필터
- 오른쪽 필터 패널: 컬럼별 아코디언이며, 여는 순간 서버에서 컬럼 요약을 받는다(pending 표시) (#20)
- 숫자·시계열: 범위 슬라이더 + 범위 반전 + null 포함. 범주: 검색 + 가상 스크롤 목록, 전부 포함에서 체크를 풀어 제외 (#20)
- draw할 때만 적용된다. 서버는 조회, 집계, split 개수에 같은 조건을 건다 (#20)

### 스키마 기반 컬럼
- 컬럼과 타입을 적재된 테이블의 스키마(information_schema)에서 읽는다. DB 타입으로 categorical / numeric / datetime을 정하고, 라벨은 컬럼 주석을 쓴다 (#20)
- 축·legend(범주이면서 8개 이하)·split·tooltip·필터 후보를 스키마로 고르고, 맞지 않는 설정은 기본값으로 바로잡는다. job은 데이터 준비 뒤 스키마로 설정을 검증한다 (#20)
- 컬럼 이름은 항상 스키마로 확인하고 식별자를 인용해 공백·한글·특수문자 이름도 안전하다 (#20)

### 품질
- 레이아웃 시프트 제거: 흐름별 CLS 0.004 이하. 필터 패널은 차트를 밀지 않는 drawer로 열어 다시 그리지 않는다 (#20)
- 정적인 인라인 스타일을 CSS로 옮기고, 런타임 값만 인라인으로 남긴다 (#20)

### API 변경
- `ColumnName`은 고정 enum이 아닌 문자열, 컬럼 타입은 `categorical / numeric / datetime`
- data 서비스: `GET /datasets/{id}/schema`(`/columns` 대체), `GET /datasets/{id}/columns/{column}/summary` 추가, split 개수 확인은 필터를 받는 `POST`
- chart 서비스: job 상태에 `counts`, `timing`, `kind`, `renderWorkers` 추가

### 바뀐 동작
- 컬럼을 스키마에서 고르므로 draw하려면 데이터를 먼저 등록해야 한다.
- 생성기 버전이 올라가(라벨을 컬럼 주석으로 저장) 기존 브라우저의 데이터는 처음 열 때 다시 만든다.

### 알려진 제약
- 다크 모드에서도 서버가 그린 차트 PNG는 밝은 테마다.
- 필터 패널은 열려 있는 동안 오른쪽 차트와 페이지 스크롤바를 덮는다.

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
