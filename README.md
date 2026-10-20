# vis-a-lot

서버사이드에서 그린 PNG 차트를 브라우저에 띄우는 **B2B 시각화 솔루션 프로토타입**입니다.

원본 제품은 Spring 서버가 DB의 raw data로 차트를 PNG로 그려 내려보내는 구조였습니다. 이 프로토타입은 그 구조를 유지하면서 **서버 유지비를 0원**으로 만들기 위해, "서버"를 브라우저 안에서 돌립니다.

- 화면은 진짜 서버에 REST로 요청하는 것과 똑같이 동작합니다 (`fetch`, `<img src>`).
- 그 요청을 MSW가 받아 Web Worker의 PGlite(WASM Postgres)와 Render Worker(OffscreenCanvas)로 처리합니다.
- 실서버로 옮길 때 화면 코드는 바뀌지 않습니다.

> 기획 과정과 모든 결정 사항은 [`docs/prototype-spec.md`](docs/prototype-spec.md)에 있습니다.

## 아키텍처

```
[화면 (React)] ──fetch / <img src>──▶ [MSW service worker] ──▶ [MSW handler (메인 스레드) = "서버"]
                                                                 │
                                                          [Job Manager]
                                                           · 순차 대기열, long polling, 취소
                        ┌────────────────────────────────────────┼──────────────────┐
                        ▼                                        ▼                  ▼
               [DB Worker: PGlite]  ──typed array transfer──▶ [Render Worker × N]
                · 시드 기반 데이터 생성 + COPY 적재              · OffscreenCanvas → PNG
                · SQL 집계 (GROUP BY, percentile_cont)            · 툴팁용 metadata
                · history 저장 (IndexedDB)                        │
                                                       [Cache API: PNG 보관]
```

## 주요 기능

| 영역 | 내용 |
|---|---|
| 데이터 | 제조/IoT 센서 데이터를 시드로 절차적 생성 (10만 / 50만 / 100만 행), 첫 방문 때 생성 후 IndexedDB 유지 |
| 차트 | scatter, bar(통계 함수 6종), boxplot(사분위수 · 1.5 IQR 수염 · 이상치). 집계는 서버(PGlite SQL)가 수행 |
| split by | 여러 컬럼을 클릭 순서대로 조합해 item grid로 분할 (최대 30,000개, 초과 시 팝업) |
| 렌더 job | 모든 렌더를 job + long polling으로 처리. 단계별 진행률, 취소, `draw → pending → cancel` |
| 툴팁 | 처음 hover 때 metadata를 받아 이후 서버 호출 없이 좌표값·가장 가까운 점 표시, 추가 컬럼만 서버 조회. 차트별 strategy pattern |
| 확대 · 도형 | 영역 확대/축소/초기화, 사각형·선·자유곡선·텍스트를 데이터 좌표로 저장해 서버가 PNG에 그림 |
| legend | 범주 컬럼으로 색 나누기 (scatter 점 / bar·boxplot 나란히 배치). PNG 안 legend 상자의 ●를 눌러 item별 색 변경 |
| 속성 | 공통 속성(전체 다시 그리기, 개별 속성 덮어쓰기), item 개별 색상 |
| 화면 크기 | resize 300ms 뒤 현재 페이지만 다시 그림, grid 크기 즉시 반영 |
| history | draw마다 1건 + 이후 변경 덧붙임, 썸네일, 복원, URL 공유 (lz-string) |

## 기술 스택

- **Next.js 16** (static export), **React 19**, TypeScript
- **MSW 3** – 브라우저 안의 REST "서버"
- **PGlite** – WASM Postgres (IndexedDB 영속화)
- **d3-scale / d3-array / d3-time-format** – 축 계산 (차트는 Canvas 2D로 직접 그림)
- **TanStack Query** – long polling, **zustand** – 작업 화면 상태
- **Vitest**, **Biome**

## 실행

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # out/ 정적 사이트 (아무 정적 호스팅에 배포 가능)
pnpm test       # 단위 테스트
pnpm lint       # Biome
```

`/dev` 페이지에서 DB Worker 부팅, 데이터 생성, Render Worker 병렬 렌더 경로를 따로 확인할 수 있습니다.

## 디렉터리

```
app/                  Next.js 라우트만 둔다 (page, layout). 화면은 src/에서 불러온다
src/                  FSD를 참고한 클라이언트 코드 (@/* = src/*)
  application/        provider, mock 서버 부팅, ssr: false 진입점 (FSD의 app 레이어)
  views/              화면 단위 조립 (FSD의 pages 레이어. Next의 app/pages와 이름이 겹치지 않게)
  widgets/            설정 패널, item grid, history 목록 같은 큰 블록
  features/           draw, grid 변경, 공통 속성, item 조작, 툴팁, 공유, 데이터 등록 같은 사용자 동작
  entities/           작업 상태 store, 차트 좌표·레이아웃·공유 링크
  shared/             API 클라이언트, React Query 훅, 공통 UI, 유틸
server/               브라우저 안의 "서버" (@server/*)
  api/                MSW handler와 REST 계약(types.ts)
  jobs/               렌더 job 실행기 (순차 대기열, long polling, 취소)
  data/               데이터 생성기, 데이터셋 적재, 차트 데이터 조회/집계 SQL
  render/             scatter, bar/boxplot, 도형 렌더러 (Canvas 2D만 의존)
  history/            history 기록과 PGlite 저장소
  workers/            DB Worker, Render Worker
docs/                 기획서
```

## 알려진 제약

- "서버" 상태(차트, job)는 브라우저 메모리에 있고, 영속되는 것은 데이터셋과 history입니다. 새로고침 후에는 history에서 복원합니다.
- PGlite를 `relaxedDurability`로 쓰기 때문에, 기록 직후 아주 빠르게 탭을 닫으면 마지막 기록이 남지 않을 수 있습니다.
- 고해상도(레티나) 대응, 도형 수정, redo, 색 외 개별 속성은 범위 밖입니다.
