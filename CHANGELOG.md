# Changelog

## [Unreleased]

### 피드 프로토타입 (관리)
- 그룹 설정 `/feed/settings/group`: 기본 정보(이름·설명·비공개·이슈 키 접두사, 바꿔도 기존 키 유지), 상태 이름(카테고리는 고정), 게시물 유형(색·순서), 팀, 멤버·역할. 그룹 관리자만 고치고 다른 사람은 읽기 전용
- 관리 콘솔 `/feed/admin`(시스템 관리자): 사용자 목록, 시스템 관리자 지정, 비활성화(맡은 열린 게시물을 보여 재배정을 안내), 그룹 목록
- 커맨드 팔레트(Ctrl/Cmd+K, 상단 검색 버튼): 게시물 찾기(`search` API: 이슈 키 → 제목 → 본문 → 댓글), 화면 이동, 새 게시물, 사용자 전환, 발표 모드. 초성 검색, 최근 항목
- 좁은 화면 점검: 390px에서 모든 피드 화면에 가로 스크롤이 없다

### 피드 프로토타입 (보고)
- 활동 보고 `/feed/report/activity`: 기간(이번 주·지난주·최근 7일·이번 달·직접 선택, 주는 월요일 시작), 팀·담당자·게시물 유형, 보고 템플릿(적용·새로 저장·덮어쓰기·지우기). 요약(활동·해결·생성), 사람별 막대, 날짜별 타임라인. 설정은 URL에 담긴다
- 보고 초안 AI: 활동 보고로 `ActivityData`를 만들어 초안을 스트리밍한다(Chrome 내장 또는 흉내). 고칠 수 있는 글 상자, 복사, 멈춤·다시 만들기
- 현황 보고 `/feed/report/status`: 열림·멈춤·닫힘, 기한 초과, 검토 대기 평균·최대 시간, 30일 리드타임 평균·중앙값, 상태 분포, 담당자별 부하, 열린·멈춘 게시물 목록
- 발표 모드(`?present=1`): 간단한 상단 바와 큰 글씨, 게시물 넘겨 보기(←/→, Esc로 보고서)
- `reports` API: 활동·현황 보고, 보고 템플릿. 사람별 해결 수는 승인 이벤트로 센다 (승인 한 번에 승인·상태 이벤트가 같이 남아 두 번 세지 않게). scheduler가 만든 이벤트는 활동 보고에서 뺀다

### 피드 프로토타입 (협업·알림)
- 댓글: 스레드와 대댓글, 반응(👍 🎉 👀 ❤️ 😄 🙏), 투표(2~6개, 마감), 스레드 해결·고정, 고치기·지우기(대댓글이 있으면 '삭제된 댓글' 자리를 남긴다). `comments` API
- 멘션: 댓글과 게시물 설명의 Tiptap 에디터에서 @이름 자동완성. 멘션된 사람에게 멘션 이력·알림을 남기고 구독시킨다. 이미 구독 중인 사람도 같은 댓글로는 멘션 알림 하나만 받는다
- 게시물 첨부: 링크와 파일(2MB, 브라우저 안에 data URL로) 추가·지우기
- 알림함: 받은 알림 / 안읽음 / 보관함, 게시물별 묶음, 읽음·안읽음·모두 읽음·보관, 누르면 옆 패널로 열고 읽음
- 알림 설정: 이벤트 × 채널(앱 내·슬랙·이메일) 표, 기본값으로
- 옆 패널은 Esc로 닫는다 (열린 팝업·멘션 목록·입력칸이 있으면 그것부터)
- 고친 것: 좁은 화면에서 표·탭 안의 화면 낭독용 글자가 스크롤 상자 밖으로 나가 페이지가 가로로 밀리던 문제, 발송 로그 표가 찌그러지던 문제, 사이드바 항목이 창이 짧으면 겹치던 문제, 비활성이 된 담당자가 고르기 목록에 id로 보이던 문제
- 고친 것: 시드 적재·리셋·가져오기 직후 새로고침하면 IndexedDB 쓰기가 끝나지 않아 데이터가 사라질 수 있었다. 이 세 경우는 저장을 기다린 뒤 응답한다

### 피드 프로토타입 (핵심 화면)
- 홈 피드: 내 작업 요약 띠(담당·승인 대기·기한 임박), 그룹 탭, 카드 피드와 끌어올리기
- 내 작업: 담당 / 내가 요청 / 승인 대기 / 이해관계자 탭(건수), 기한순, 닫힌 것 포함 토글
- 리스트: URL에 담기는 필터, 열 선택·정렬·그룹핑(상태·담당자·우선순위), 다중 선택 일괄 변경, 뷰로 저장
- 보드: 상태 열 칸반, 드래그(키보드 포함)로 상태 변경(검토 중 열로 옮기면 완료 요청, 보류·취소·반려는 사유 입력), 팀 스윔레인
- 저장된 뷰: `/views` API(기본 제공 뷰 탐색·관심, 개인·그룹 공유, 고정), 피드·리스트·보드로 보기, 내 뷰로 복사, 사이드바 고정 뷰
- 게시물 상세(전체 페이지와 옆 패널 `?peek=키`): 권한에 맞는 동작 버튼(진행 시작·완료 요청·승인·반려·보류·취소·다시 열기), 본문(Tiptap), 필드 편집, 체크리스트, 관계, 첨부, 활동 로그
- 빠른 생성(C 키)과 전체 폼(`/feed/new`, AI 추천). vis-a-lot 차트 공유 가져오기(`GET /imports/chart-shares/{shareId}`)
- 그룹 목록은 공개 그룹 먼저, 이름순 (첫 그룹이 기본 그룹)
- OAS: 이름 붙인 스키마의 nullable을 anyOf(T, null)로 적어 생성 타입에서 null이 빠지던 문제(`dueDate`, `myRole`, `parent` 등)를 고쳤다

### 피드 프로토타입 (기반)
사내 데이터 공유 피드 1차 프로토타입을 `/feed` 아래에 만든다. 범위·결정·규칙은 `docs/feed-prototype-spec.md`.
- 피드 서비스 `/api/feed`(Hono + zod, OAS `public/openapi/feed.json`): 사용자·그룹·게시물·알림·scheduler·시드·system API. 로그인 대신 화면에서 고른 사용자를 `x-feed-user` 헤더로 보낸다
- DB: vis-a-lot PGlite의 `feed` 스키마(`server/feed/ddl.ts`). op는 DB Worker 안에서 트랜잭션 하나로 돌고, 쓰기는 변경 이력(events) → 알림 생성까지 한 번에 끝낸다
- 게시물: 이슈 키(FD-12), 상태 6개·카테고리 3개 전이 규칙(완료 요청·승인·반려·보류·취소·다시 열기), 권한, 진행률 자동 계산(하위·체크리스트), 관계(상위/하위·차단·중복·관련), 차단 해제·하위 완료 이벤트, 일괄 변경, 목록 필터·정렬
- 알림: 이벤트 × 채널(앱 내·슬랙·이메일) 기본값과 설정, 알림함(게시물별 묶음·읽음·보관), 슬랙·이메일은 발송 로그(outbox)에 남긴다. scheduler가 기한 D-1·당일·초과(하루 1회)와 보류 자동 복귀를 맡는다
- 시드: 사용자 8명, 그룹 2개(FD 공개·DX 비공개), 게시물 60개, 댓글 120개, 4주치 이력, 알림·저장된 뷰·보고 템플릿. JSON 내보내기·가져오기
- 화면: `/feed` 셸(사이드바, 사용자 전환, 알림 배지, AI 배지, 좁은 화면 서랍), 개발 장치 `/feed/dev/seed`·`/feed/dev/clock`(시계 오프셋)·`/feed/dev/outbox`. 나머지 화면은 자리만 두고 다음 PR에서 채운다
- AI 어댑터(`src/shared/lib/ai`): Chrome 내장 Prompt API와 결정적 흉내 어댑터. 보고 초안 스트리밍, 요약, 필드 추천
- 개발 환경: 테스트 타임아웃 30초(PGlite 부팅), vitest·tsc·biome이 `.claude/worktrees`를 보지 않는다

### 공유 페이지
- `링크 복사`가 hash 링크 대신 chart 서비스 공유를 만들고 공유 페이지 링크(`/share?id=…`)를 복사한다. 예전 hash 링크(`#s=…`)도 열린다
- 공유 페이지: 스냅숏 PNG와 제목·만든 사람·시각·데이터셋·차트 종류, `gallery에서 열기`(새 gallery 탭에 다시 그림)·`링크 복사`·`피드에 올리기`·`지우기`(만든 사용자만). 지운 공유는 '없는 공유'로 열린다
- `/share`는 내 공유 목록(카드). 상단 바에 `shares` 링크
- 상단 바 화면 버튼·링크 모양을 `navButton`·`navLink` recipe(`src/shared/ui/nav.ts`)로 묶어 작업 화면과 공유 페이지가 같이 쓴다
- `피드에 올리기`(탭 도구 줄, 공유 페이지): 공유를 만들고 피드 전체 폼 `/feed/new?share=…`을 새 탭으로 연다. 폼이 차트 게시물(제목·대표 PNG·공유 링크)을 채운다

### API
- `GET /shares`: 내가 만든 공유 목록(최근 순). `Share.createdByName`(만든 사용자의 표시 이름)
- chart 서비스 공유: `POST /shares`(`{ chartId, itemKey?, title }` → 201 `Share`), `GET /shares/{shareId}`, `GET /shares/{shareId}/png`(인증 없음), `DELETE /shares/{shareId}`(만든 사용자만). 만든 시점의 설정·바뀐 item 상태·대표 PNG를 PGlite `shares` 테이블에 고정한다
- 공유의 item 상태는 history와 같은 필드(legend 숨김 `hiddenLegend`, 개별 차트 속성 `options` 포함)를 담는다. history 기록과 공유가 `server/charts/item-restore.ts`를 같이 쓴다

## [0.13.0] - 2026-10-23

화면 스타일을 CSS Modules에서 Tailwind CSS v4로 옮겼다. 여러 기능이 함께 import하던 공용 모듈과 자손 선택자 때문에 스타일이 다른 컴포넌트로 새던 문제를 구조적으로 막는다. 규칙은 `docs/styling.md`에 있다. 설정 팝업은 확인·취소로 바꿔 확인을 눌러야 반영되고, 공통 속성은 draw를 누를 때 적용된다. git flow는 git 훅과 GitHub branch protection이 강제한다.

### 설정 팝업
- 전체 설정·item 속성 팝업은 확인·취소로 닫는다. 팝업 안에서 바꾼 값은 확인을 눌러야 반영되고, 취소·Esc는 버린다. 폼은 react-hook-form으로 다시 짰다
  - 전체 설정: 확인하면 다음 draw에 쓸 설정이 바뀌고, 그린 차트에는 draw를 눌러야 적용된다(바꿀 때마다 전체를 다시 그리던 것을 멈춘다). 가까운 점 표시는 화면 표시라 확인하면 바로 바뀐다
  - item 속성: 확인하면 바꾼 차트 속성·색·범례 값별 색·legend 위치를 한 요청으로 보내 그 item만 한 번 다시 그린다
  - 따로 정해 둔 값은 같은 값이 돼도 정한 채로 두고, 구역 되돌리기(기본값으로, 공통 속성 따르기)는 그 구역을 저장에서 지운다
- 팝업 높이를 정해 두고 메뉴와 내용이 각자 스크롤한다. 긴 구역(축)이 팝업 밖으로 넘쳐 닫기 버튼을 덮던 문제를 고쳤다
- 축 구역을 X축·Y축 하위 메뉴로 나눴다
- item의 ⚙ 버튼이 item 속성 팝업을 바로 연다. legend 위치는 범례 구역에, item 색·범례 값별 색은 팔레트 구역에 둔다(전체 설정과 같은 자리)

### API
- `PATCH /charts/{id}/items/{key}/props`에 `{ settings: { color?, legendColors?, legendPosition?, options? } }`를 더했다. 여러 속성을 한 번에 바꿔 한 번만 다시 그린다

### 스타일
- CSS Modules 23개(3,734줄)를 지우고 각 컴포넌트에 Tailwind 클래스를 둔다. CSS 파일은 `app/globals.css`(토큰·요소 기본값) 하나만 남긴다
- 토큰: 쓰임새 이름 색(기본 팔레트는 끈다), rem 글자 크기(`text-ui` 13px가 본문 기본)와 짝지은 줄 높이, 그림자
- 여러 곳이 같이 쓰는 모양은 `tv()` recipe로 모은다(`button`, `toolButton`, `selectStyles`, `segmented` …)
- 간격·radius를 테마 축척에 맞췄다. 줄 높이가 토큰 값이 되어 필드와 메뉴가 1–3px씩 높아졌다
- 팝업 하단 primary 버튼이 secondary와 같은 높이가 된다
- z-index를 쓰임새 이름 토큰(`z-popover`, `z-sticky` …)으로 바꾸고 숫자 z-index를 막는다

### 개발 환경
- Biome 2.6: Tailwind 규칙(클래스 정렬, 축약, v3 이름, 팔레트 색, 조합한 클래스 문자열)과 GritQL 플러그인 두 개(자손 변형·토큰 밖 색·`!important`, 축척 밖 값)
- Stylelint: 스타일이 새는 선택자와 토큰 밖 색을 막는다. `pnpm lint`가 Biome 다음에 돌린다
- `*.module.css` import를 막는다
- 데이터 테이블의 빈 채움 행 a11y lint 오류를 이유를 적어 끈다
- git flow를 git 훅으로 강제한다(`scripts/check-git-flow.sh`, husky `pre-commit`·`pre-merge-commit`·`pre-push`). main·develop에서는 로컬 커밋·병합과 직접 push를 막는다. 규칙은 `docs/git-flow.md`에 있다
- 저장소를 public으로 바꾸고 main·develop에 GitHub branch protection(PR 필수, 관리자 포함, force push·삭제 금지)을 켰다. 릴리스 뒤 back-merge도 main → develop PR로 한다

## [0.12.0] - 2026-10-23

원본 제품의 하위 차트(서브 차트)를 기본 차트에 더했다. 차트를 고르면 그 차트의 서브 차트를 고를 수 있고, 첫 값이 기본이다.

### 서브 차트
- Line: None · ECDF(누적 비율) · NCDF(같은 평균·표준편차의 정규 누적확률) · Probability(정규 분위수 z). 분포 서브 차트는 y 컬럼 값의 분포를 legend 계열마다 그리고 x 컬럼은 쓰지 않는다. 점 좌표가 컬럼 값이 아니라 지우기와 선택 필드(선택 영역으로 데이터 거르기)는 쓰지 않는다
- Bar: Side(나란히, 기존) · Stack · Stack 100(범주 합계 대비 %, 축 0~100). 쌓인 막대도 툴팁·선택·체크박스로 끄기가 동작한다
- Boxplot: None · Dot(상자마다 원값 표본 최대 300개를 겹쳐 찍는다. 표본은 행 위치 해시 순이라 다시 그려도 같다)
- Pie: None · Doughnut(합계·개수면 가운데에 합계) · Pie 3D · Sunburst(legend 컬럼으로 조각을 나눠 바깥 고리에 그린다)
- 제외: Wafer(웨이퍼 데이터·차트가 없다)

### 화면
- 차트 종류 버튼 격자(14개)를 '차트'·'서브 차트' select 두 개로 바꿨다. 차트가 늘어도 왼쪽 패널 높이가 그대로라 x·y·legend를 스크롤 없이 고른다
- 탭·history 이름에 기본이 아닌 서브 차트를 붙인다 (예: 'Bar Stack 100 · 공장 × 평균(측정값)')

### API
- `ChartSpec.subType`(선택, 없거나 그 차트에 없는 값이면 기본). 예전 history·공유 링크는 그대로 열린다
- `CategoryMeta.stack`·`segments`, `PieMeta.variant`·`radiusY`·`innerRadius`·`ring`·`children`

### 개발 환경
- 브랜치 이름 규칙: `feat|feature|fix|chore|refactor|docs|test|release/<kebab-case>`와 `main`·`develop`·`release`만 쓰고, 클라우드 세션이 자동으로 붙이는 이름(`feat/<단어>-<단어>-<6자리>`, `ccr-…`)은 막는다. 규칙은 `scripts/check-branch-name.sh`에 있다
- Claude PreToolUse 훅(`.claude/hooks/check-branch.mjs`)이 브랜치를 만들거나 push하는 명령을, husky `pre-push`가 사람의 push를 같은 규칙으로 검사한다. 이름 짓는 법은 `git-branch` 스킬에 둔다

## [0.11.0] - 2026-10-23

원본 제품의 차트 속성(Title, Axes, Legend, Panel, Palette, Shape, Size, Point Label, Score, Prediction, Value, Focus, ToolTip, Expression)을 공통 속성과 item 개별 속성에 더했다. 차트별로 쓸 수 있는 구역은 원본의 'Availability of Chart-Specific Options' 표를 14종 차트에 옮겨 정한다.

### 차트 속성
- 속성 모델: `server/render/options.ts`(모양·기본값), `server/charts/chart-options.ts`(차트별 지원 표). 그릴 때 기본값 → 공통 → item 개별 순으로 깊게 합치고, 차트가 쓰지 않는 구역은 저장하지 않는다
- 기본값은 지금까지의 PNG와 같다. 속성을 정하지 않으면 그림이 바뀌지 않는다
- Title: 제목 바꾸기·부제목·글자·색·정렬 / Panel: 배경색·그라데이션·테두리·여백 / Legend 모양: 보이기·테두리·순서 뒤집기·글자
- Axes: x·y 보이기, 축 제목, 최소·최대·로그(양수 범위에서만), 축선·그리드·눈금·라벨(각도·글자·색), 소수 자리, 시계열 형식. 확대 범위가 최소·최대보다 우선한다
- Palette: legend 기본 색을 시작→중간→끝 그라데이션 단계로 (heatmap은 순차 색 척도)
- Shape: 점 모양 5종, 채우기/테두리/둘 다, 투명도, 테두리 굵기 / Size: 점 크기 자동·고정·범위, 글자 크기 자동·범위, 선 굵기
- Point Label: 막대 끝 값, 중앙값, 칸 값, 조각 값 등. 앞뒤 글자·소수 자리·각도·상자, 겹치면 건너뛴다
- Score(scatter, line): rscore·fscore(legend별 ANOVA)·zscore·Cpk 상자
- Prediction(scatter, line): 이동 평균, 단순·이중 지수 평활, Holt-Winters. 비운 매개변수는 자동 맞춤, 신뢰 구간 띠·설명
- Value: 빈 칸 값(null to numeric), 이상치 제외(IQR·σ) / Focus: 조건(> ≥ < ≤ = ≠)에 맞는 점·막대·캔들·작업을 강조
- Expression(scatter, line, bar): eval 없이 해석하는 식(x, y, + - * / ^, abs log ln sqrt exp round floor ceil min max pow)
- ToolTip: 화면 툴팁의 제목·글자·배경·투명도·모서리·테두리·앞뒤 글자·소수 자리
- 제외: Wafer·Selection·Multi Axis(해당 차트·기능 없음), pie·treemap·funnel의 Axes(축 없는 차트)

### 화면
- 전체 설정 팝업의 메뉴가 곧 원본 속성 구역이다. 차트가 쓰는 구역만 보이고, 구역마다 기본값으로 되돌리기
- 기존 색상·legend·split by·툴팁 메뉴는 원본 구역 안으로 옮겼다: 팔레트(기본 색·범례 값별 색), 범례(위치), 제목(연결 문자 = split 구분 기호), 툴팁(가까운 점 표시). 저장 위치는 그대로라 예전 history·공유 링크가 그대로 열린다
- 범례 구역은 범례 모양을 쓰지 않는 차트(heatmap·candle·waterfall)에도 위치 설정 때문에 둔다
- item 설정 → 개별 속성 팝업. 구역별·전체 공통 속성 따르기
- 메뉴·필드 라벨은 한글로만 적는다 (영문 병기를 뺐다. 이후 intl 대응)

### API (호환 깨짐)
- `CommonProps.options`, `ItemRestore.options`, `ItemState.options`, `ItemPropsRequest { options }`(item 속성 전체를 바꾼다, null이면 지운다)
- `AxisMeta.log`: 로그 축이면 화면이 log10 공간에서 좌표를 환산한다
- history 이벤트 `options`
- 축 제목을 켜면 기본 글자는 컬럼 라벨이다 (histogram y는 '개수')

## [0.10.0] - 2026-10-23

데이터 테이블을 item 데이터와 전체 데이터 두 가지로 다시 정의하고, 서버의 SQL을 Kysely로 옮겼다.

### 데이터 테이블
- item 데이터 테이블: 고른 item의 원본 행을 데이터셋의 모든 컬럼으로 본다. 14종 모든 차트에서 쓴다. 대상 행은 split 조합 + draw 시점 필터 + 체크박스로 끈 legend 값 제외이고, 선택 필드 차트(scatter, line, bar, boxplot, histogram, waterfall)는 선택 영역이 있으면 그 안의 행만 둔다. 데이터 다운로드(CSV)도 같은 기준으로 모든 컬럼을 담는다
- 전체 데이터 테이블(새 버튼): 데이터셋 전체를 draw 시점 필터로 거른 행. 30,000행을 넘으면 `tablesample bernoulli`(고정 seed)로 넉넉히 뽑아 행 위치 해시 순으로 30,000행 샘플만 준다. 페이지·정렬이 바뀌어도 같은 샘플이고 저장 순서 앞쪽에 몰리지 않는다 (`POST /charts/{chartId}/rows`)
- 두 표 모두 그린 차트에 저장된 필터만 쓴다. 필터 패널에서 고친 값은 draw 전까지 반영하지 않고, 표 머리에 적용한 필터 수를 적는다

### 수정
- split 없는 candle이 전부 하락으로 그려지던 문제. 같은 시각에 설비·센서 행이 여럿인데 시가/종가를 행 순서로 골랐다. 시각마다 평균한 뒤 구간의 첫/끝 시각 평균을 시가/종가로 쓴다 (10만 행: 하락 120개 → 상승 75·하락 45)
- split·필터가 없는 pie·sankey·heatmap에서 데이터 테이블·다운로드가 SQL 오류로 깨지던 문제

### 내부
- PGlite SQL을 Kysely(0.29, 내장 PGlite dialect)로 옮겼다. `server/db/database.ts`가 인스턴스와 고정 테이블 타입(history, dataset_meta 등)을, 동적 데이터셋 테이블은 `sql` 조각으로 합쳐 `$n` 번호 계산을 없앴다. PGlite 전용 기능(COPY, 배열 행)은 `server/db/pglite-native.ts` 한 곳에 모았다. 다른 Postgres로 옮길 때는 dialect만 바꾼다

## [0.9.0] - 2026-10-22

차트 종류를 3종에서 14종으로 늘리고, 상단 도구 줄의 모드·도구를 차트 종류마다 켜고 끈다.

### 차트 추가
- Line: 행 단위 점을 legend 계열별로 x 순서대로 잇는다. 픽셀 열마다 first/min/max/last만 남겨(M4) 그린다. 점 삭제와 선택 필드는 scatter와 같다
- Histogram: 숫자 x 하나의 분포. 구간은 필터를 건 전체 범위에서 한 번 정해(30개 안팎) 모든 item이 같은 구간을 쓴다. legend 값별 막대를 나란히 놓는다
- Waterfall: 범주별 집계값을 차례로 쌓고 끝에 합계 막대. 증가·감소·합계가 legend 항목이다
- Funnel: 범주(단계)를 값 큰 순으로 가운데 정렬 막대로 그리고 단계 사이에 전환율을 적는다. 8단계를 넘으면 위 7개 + 기타
- Pie: 범주별 집계 조각. 상위 8개 + 기타, 체크박스로 숨기면 남은 조각으로 비율을 다시 계산한다
- Radar: 범주를 축(최대 12개)으로, legend 값별 다각형
- Heatmap: x 범주·시계열(자동 시간 구간) × y 범주 칸을 z 집계값의 순차 색과 색 막대로
- Treemap: x 범주 칸 넓이 = 집계값, legend가 있으면 부모 묶음(2단계). d3-hierarchy squarify
- Candle: 시계열을 자동 구간으로 나눠 구간마다 OHLC. 상승/하락이 legend 항목이다
- Gantt: y 범주(작업 행)마다 legend 값이 이어지는 구간(gaps-and-islands)을 막대로. 같은 픽셀 안 짧은 구간은 합친다
- Sankey: x 범주 → y 범주 흐름을 z 집계값 굵기로. 출발 상위 7개·도착 상위 11개 + 기타, d3-sankey
- 제외: Wafer(2D/Defect), Dynamic, EdgeBundle

### 차트별 도구 줄
- 차트 종류별 기능 표(이동·확대·사각형/자유형 선택·선택 필드·사각형/자유형 삭제·페인트·체크박스 표시)로 모드 바와 차트 도구를 켜고 끈다. 선택 필드 = 선택 영역 기준 데이터 다운로드·데이터 테이블
- 못 쓰는 버튼은 비활성하고 title에 이유를 적는다. 지금 모드를 못 쓰는 차트를 그리면 기본 모드로 돌린다
- 컬럼 역할(x·y·z 타입, 통계 함수, legend 컬럼 사용)도 같은 표로 정한다. 왼쪽 패널은 차트가 쓰는 select만 보여준다

### API
- `ChartSpec.z`: 세 번째 값 컬럼(heatmap·sankey)
- `ChartType`에 11종, `ItemMeta`에 차트별 metadata 추가
- 점 삭제는 점을 그리는 차트(scatter, line)만, 데이터 표·다운로드는 행 규칙을 아는 차트만 받고 나머지는 409

### 수정
- funnel 단계 사이 전환율을 감소율로 오해하지 않게 '전환'으로 표시

## [0.8.0] - 2026-10-22

확대와 이동이 사용자에게 주는 피드백을 바로잡았다.

### 수정
- 좁은 시계열 확대: split by LOT처럼 item의 측정 시각이 하나뿐인 산점도를 확대하면 점이 가운데가 아니라 오른쪽 끝에 그려지던 문제. x 범위가 앞뒤 1ms였고 `scaleUtc`가 범위를 Date로 바꾸며 밀리초 아래를 버렸다. 점 위치는 숫자 선형 축으로 계산하고 시계열은 눈금만 UTC 축에서 받는다
- 값이 하나뿐인 시계열은 앞뒤 1ms 대신 앞뒤 1분을 보여준다
- 시계열 눈금 글자: 보이는 범위가 좁으면 초(`%H:%M:%S`)·밀리초까지 적어 `00:00 00:00`처럼 같은 글자가 반복되지 않는다

### 변경
- 이동 모드: 끄는 동안 PNG를 옮겨 보여주지 않고 그림은 그대로 둔 채 커서만 grab으로 바꾼다. 놓으면 옮긴 범위로 다시 그린다

## [0.7.0] - 2026-10-22

상단 도구 줄을 모드 바와 차트 도구로 나누고, 차트 위 영역을 다루는 이동·선택·삭제와 다운로드·데이터 표를 더했다. 그리기 도구는 페인트 모드의 item 도구로 옮겼다.

### 도구 줄 개편
- 모드 바: 기본 / 이동 / 확대 / 사각형 선택 / 자유형 선택 / 사각형 삭제 / 자유형 삭제 / 페인트. 구분선 뒤 차트 도구: 체크박스 표시, 차트 다운로드, 모든 차트 엑셀로 다운로드, 데이터 다운로드, 데이터 테이블
- 사각형·선·자유곡선·텍스트와 도형 되돌리기·전체 삭제는 페인트 모드일 때만 item 좌측 상단에 우측 툴바와 같은 모양으로 띄운다
- item을 누르거나 포커스가 들어오면 그 item을 고른 것으로 보고 테두리를 강조한다. item 하나를 대상으로 하는 도구가 이 item을 쓴다

### 이동 · 선택 · 삭제
- 이동: 차트를 끄는 동안 PNG를 옮겨 보여주고, 놓으면 옮긴 범위로 다시 그린다 (`view` 요청 `type: pan`)
- 사각형·자유형 선택: 영역을 데이터 좌표로 저장하고 바깥 점(막대/상자)을 흐리게, 제목 줄에 선택 수를 그린다. 클릭하면 해제
- 우클릭 메뉴(Base UI ContextMenu): 즐겨찾기에 추가, 새 범례(영역 안 점을 새 legend 항목으로), 선택 해제, 즐겨찾기 선택·삭제, 새 범례 삭제, 지운 점 모두 되돌리기
- 사각형·자유형 삭제(scatter만): 영역 안 점을 그 item에서 빼고 점 수·툴팁·선택 수에도 반영한다. item 툴바에서 마지막 삭제를 되돌린다
- 선택·즐겨찾기·새 범례·삭제 영역은 item 상태라 history와 공유 링크로 복원된다

### legend 체크박스
- 체크박스 표시를 켜면 PNG legend의 색 표시 자리에 체크박스를 겹친다. 풀면 그 item에서 그 값을 숨기고(속 빈 원·흐린 글자) 점·막대·상자와 툴팁 대상에서 뺀다

### 다운로드 · 데이터 테이블
- 차트 다운로드: 고른 item의 PNG
- 모든 차트 엑셀로 다운로드: 모든 item 이미지를 차트 grid 배치로 넣은 시트 + 목록 시트(xlsx, exceljs 동적 import, 300개 상한)
- 데이터 다운로드: 고른 item이 그린 행(지운 점·끈 legend 값 제외, 선택이 있으면 그 안)을 CSV로. DB Worker가 Postgres 기하 연산으로 고르고 `COPY TO '/dev/blob'`으로 만든다
- 데이터 테이블: 같은 행을 가상 스크롤 표로 보고 열 머리로 서버 정렬한다
- chart API 추가: `PUT .../selection`, `.../favorites`, `.../legend-groups`, `.../deletions`, `POST .../rows`, `POST .../rows/export`, props `legendVisible`

## [0.6.0] - 2026-10-22

파일 업로드와 등록된 데이터 목록을 나누고, 업로드에서 원본을 보며 전처리 옵션과 컬럼 타입을 정한다. 툴팁과 지운 데이터의 오류 처리를 다듬었다.

### 업로드와 데이터스토어 분리
- 상단 `data` 버튼을 `upload`(파일 열기)와 `datastore`(데이터 목록)로 나눴다. 업로드가 끝나면 그 데이터를 고른 데이터스토어 팝업으로 바로 넘어간다
- 파일 열기 팝업: 파일 목록, 원본 앞부분, 전처리 옵션, 미리보기 표. 표 머리에서 컬럼별 포함과 타입(자동·범주·숫자·시계열)을 정하고, 바꿀 수 없는 값은 빨갛게 표시한다. `검사`로 파일 전체를 적재 없이 확인한다
- 전처리 옵션 추가: 따옴표, 날짜 시간 형식(yyyy-MM-dd HH:mm:ss 등 패턴), 데이터 오류 무시(못 읽는 값은 null, 깨진 행은 건너뜀), 인코딩
- 적재 진행(검사·변환 → 대기 → 적재 → 컬럼 통계)을 long polling으로 받는다. 검사·변환 중에도 2만 행마다 양보해 진행률이 오른다
- 데이터스토어 팝업: 이름 검색, 수정·삭제·새로고침, 가상 스크롤 표(번호, 이름, 등록 시간, 행 수, 크기, 상태), 저장소 사용량. 샘플은 맨 아래에 두고 등록을 눌러야 쓴다
- 수정은 같은 파일 열기 팝업을 수정 모드로 연다(저장한 옵션·타입·포함 컬럼을 채워 보여주고 다시 적재)
- data API: `POST /datasets/uploads`와 옵션 수정 `PATCH`를 staging(`/datasets/staging/…` preview·check·commit·task) 흐름으로 바꿨다. `PATCH /datasets/{id}`는 이름만 바꾼다

### 수정
- 크게 보기에서 도형을 그리면 다시 그리는 동안 작은 grid PNG로 돌아가 줄었다 커지는 것처럼 보이던 문제
- 툴팁: service worker가 다시 뜬 뒤 요청이 mock 서버를 벗어나던 문제, metadata 요청이 한 번 실패하면 그 PNG에서 툴팁이 다시 안 나오던 문제, 다시 그린 뒤 커서를 움직여야 툴팁이 나오던 문제, 좌우 legend scatter에서 가까운 점을 못 찾던 문제, 2000px을 넘는 grid item을 다시 그리지 못하던 문제
- legend 없는 item 설정의 색 팔레트가 찌그러지던 문제
- 지운 데이터셋: 필터 패널이 끝없이 불러오던 문제, draw 버튼이 이유 없이 막히던 문제, history·탭에 id가 그대로 보이던 문제, 그 history를 열면 빈 화면만 보이던 문제. chart 서비스가 data 서비스의 상태 코드(404 지운 데이터, 409 준비 전)로 사유를 정해 grid·하단·알림에 보여준다
- 다시 그리기 job이 실패하면 item이 대기 상태로 남아 조작 차단이 풀리지 않던 문제
- 툴팁 추가 컬럼을 받지 못하면 자리 표시가 계속 남던 문제 (지운 데이터면 404, '–'와 사유 표시)

## [0.5.0] - 2026-10-21

CSV·zip을 올려 자기 데이터로 그린다. 데이터셋을 행 수가 아니라 id로 구분한다.

### CSV 업로드
- data 팝업에 '업로드한 파일' 목록(이름, 크기, 등록 시간, 구분 기호, 첫 번째 행 헤더, Null 값, 상태)과 수정·삭제·업로드 버튼을 더했다
- CSV 하나 또는 CSV를 묶은 zip을 올린다. zip 안의 CSV는 한 데이터셋으로 합치고, 컬럼 수·이름·타입이 하나라도 다르면 전체를 거절하며 어느 파일의 어느 컬럼이 다른지 알려 준다
- 전처리: 구분 기호(직접 입력 포함), 첫 번째 행 헤더, Null 값. UTF-8이 아니면 EUC-KR로 읽고 BOM은 뗀다
- 컬럼 타입은 값으로 추론하고(숫자 / 시계열 / 범주), 수정 팝업에서 컬럼별로 직접 정할 수 있다
- 수정하면 보관한 원본으로 다시 검사·적재한다. 거절되면 기존 데이터를 그대로 둔다
- zip·CSV 라이브러리(fflate, papaparse)는 업로드 때, 업로드·수정 팝업은 처음 열 때 불러온다

### 데이터셋 id
- 차트 설정·history·공유 링크가 행 수(`rows`) 대신 데이터셋 id(`iot-100k`, `up-…`)를 저장한다. 예전 history와 링크, 등록해 둔 샘플은 그대로 옮겨 쓴다
- data API: `GET /datasets`, `POST /datasets/uploads`, `PATCH`·`DELETE /datasets/{id}`를 더하고 `rows` 파라미터를 없앴다

### 수정
- 팝업(`<dialog>`) 안에서 Select·OrderedSelect 목록이 dialog 아래에 깔려 고를 수 없던 문제. dialog 안이면 목록을 그 dialog 안으로 띄운다

## [0.4.0] - 2026-10-21

item을 크게 보는 화면과 섬네일, legend 위치, 우측 상단 item 툴바를 더하고, 모든 로딩 상태에 자리 표시를 둔다.

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

### API
- `POST /charts/{chartId}/items/{itemKey}/detail`: 크게 보기 PNG. 같은 내용·크기로 그려 둔 게 있으면 `{ image }`, 없으면 그 한 장만 그리는 `{ jobId }`
- `GET /charts/{chartId}/items/{itemKey}/meta?size=WxH`: 크게 보기 PNG의 metadata
- `GET /jobs/{jobId}?offset=`: 페이지 경계와 상관없이 그 순번부터 `pageSize`개. 응답에 `offset`
- `ItemState`에 `thumbnail`, `revision`(그림 내용이 바뀔 때만 오름), `legendPosition`
- `CommonProps`·`ItemRestore`에 `legendPosition`, `PATCH .../props`에 `{ legendPosition }`, history 이벤트 `legend`

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
