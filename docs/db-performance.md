# DB 성능 점검 (PGlite 임베디드 벤치마크)

배포판은 브라우저 Worker 안의 PGlite(WASM Postgres 18.6)를 쓴다. 이번 점검은 같은 PGlite를 Node에서 임베디드(파일 저장)로 띄워, 기본 시나리오보다 훨씬 큰 데이터로 DB 설계와 쿼리를 쟀다. 엔진·JS 드라이버가 브라우저와 같으므로 결과의 방향은 배포판에도 그대로 적용된다 (절대값은 기기마다 다르다).

재현: `pnpm bench:db` (옵션은 `scripts/bench-db/run.mts` 머리 주석). 결과 비교: `tsx scripts/bench-db/compare.mts before.json after.json`.

## 측정 환경

| 항목 | 값 |
| --- | --- |
| 엔진 | PGlite 0.5.10 (PostgreSQL 18.6, wasm32), Node 22, 파일 저장 + `relaxedDurability` (DB Worker와 같은 설정) |
| 피드 데이터 | 사용자 1,000 · 그룹 20(비공개 5) · 게시물 50,000 · 댓글 201,085 · 반응 201,246 · 이력 550,383 · 알림 2,199,996 · 구독 205,690 · 체크리스트 100,002 (`scripts/bench-db/feed-fixture.ts`, 결정적 난수, 1년치) |
| 차트 데이터 | 샘플 데이터셋 `iot-1m` (100만 행, 생성기 그대로) |
| 측정 | 피드 op는 `runFeedOp`(트랜잭션 포함)로 warmup 2회 후 10회 중앙값, 차트 쿼리는 5회 중앙값. 느린 문장은 `EXPLAIN (ANALYZE, BUFFERS)`로 계획을 남긴다 |
| 비교 | 바꾸기 전 코드(develop)와 바꾼 코드를 같은 스크립트로, 같은 시간에 나란히 돌렸다 |

## 먼저 조사한 것: 기존 SQL에서 쓸 수 있는 최적화

| 후보 | 조사 결과 | 판정 |
| --- | --- | --- |
| **통계(ANALYZE)** | PGlite는 단일 사용자 모드라 `autovacuum = on`이어도 autovacuum이 **한 번도 돌지 않는다**. 20만 행을 넣고 기다려도 `reltuples = -1`, `pg_stats`가 비어 있다. 플래너는 모든 테이블을 기본 어림값으로 계산한다 (예: 100만 행 데이터셋을 37만 행, 그룹 16개를 37,374개로 어림) | 적용: 시드·가져오기·리셋 뒤, 데이터셋 적재 뒤, 통계 없는 예전 DB를 처음 열 때 ANALYZE |
| **플래너 비용(`random_page_cost`)** | 기본값 4는 HDD 기준인데 PGlite의 페이지는 모두 메모리에 있다. 활동 보고의 이력 조회에서 플래너가 `events(post_id, created_at)` 인덱스로 게시물 2,865건만 찾는 nested loop(105ms) 대신 이력 15만 건을 해시 조인(320ms)했다 | 적용: `1.1` |
| **`work_mem`** | 기본 4MB면 100만 행 median·상자 그림·샘플 정렬이 `external merge Disk: 33MB`로 넘친다. PGlite의 "디스크"는 가상 파일시스템이다 | 적용: `64MB` (median 2169→1730ms, 상자 그림 3857→3125ms, 단독 측정) |
| **외래 키 인덱스** | Postgres는 외래 키 컬럼에 인덱스를 만들지 않는다. `comments.post_id`, `posts.parent_id`, `post_relations.to_id`, `checklist_items.post_id`, `attachments.post_id`, `polls.comment_id`, `post_stakeholders.user_id`에 인덱스가 없어, 게시물 상세·목록 요약이 댓글 20만·게시물 5만 행을 매번 순차 스캔했다 | 적용 |
| **목록 정렬·필터 인덱스** | 기본 피드(최근 수정순 50건)가 볼 수 있는 4.2만 건을 전부 정렬, 관심(팔로우) 필터가 작성자로 전체 스캔, scheduler가 오늘 만든 기한 알림을 찾으려 이력 55만 건을 스캔 | 적용: `posts(updated_at)`, `posts(author_id)`, `events(kind, created_at)`, `saved_views(owner_id)` |
| **글자 검색(`ilike '%…%'`)** | 검색은 제목·키·본문·댓글(`jsonb::text`)을 모두 순차 스캔해 1.4~1.8초. `pg_trgm`이 PGlite contrib에 있고(15KB), DB 로캘이 `C.UTF-8`이라 **한글 trigram도 동작**한다. 세 글자 이상이면 GIN 인덱스를 쓰고, 두 글자는 플래너가 순차 스캔으로 되돌아간다 | 적용: GIN trigram 인덱스 4개 |
| **`extract(epoch)`** | PG14부터 `extract`는 numeric을 돌려줘 행마다 무겁다. 30만 행에서 669ms → `date_part` 124ms. 단순히 `date_part * 1000`으로 바꾸면 25%의 행이 끝자리가 달라지지만, 마이크로초로 반올림한 뒤 1000으로 나누면(`round(date_part('epoch', ts) * 1e6) / 1000`) 30만 개 무작위 시각(1900~2150년, 마이크로초 포함)에서 기존 값과 **모두 같다** | 적용: 시각 → epoch ms 식(`numericSql`) |
| **결과 전송 방식** | 점 차트 쿼리는 실행보다 PGlite가 결과 행을 넘기는 비용(행당 약 3.6µs + 컬럼 파싱)이 컸다. 10만 행: 서버 실행 23ms(count) vs 행으로 받기 1.3초. `array_agg(float8)`는 PGlite의 배열 파서가 느려 0.43초, `string_agg(text)`로 받아 JS에서 나누면 컬럼당 약 0.1초 | 적용: split 조합마다 한 행으로 묶어 x·y·id·legend를 글자 하나로 받는다 |
| N+1 쿼리 | `views.list`가 뷰마다 그룹 역할을 따로 물어 511문장, `groups.list`가 그룹마다 1문장 | 적용: 역할을 한 번에 읽는 `groupRoles` |
| 인덱스 전용 스캔(count 가속) | 목록마다 전체 개수(`count(*)`, 4.2만 행 30~50ms)를 센다. 인덱스 전용 스캔은 visibility map이 있어야 효과가 있는데, VACUUM이 돌지 않아 비어 있다 | 적용 안 함 (아래 남은 과제) |
| `notifications(user_id, created_at)` | 알림함 정렬용으로 시험했지만 알림함 쿼리에 LIMIT이 없어 정렬만 incremental sort로 바뀌고 빨라지지 않았다. 가장 큰 테이블(220만 행)의 쓰기 비용만 늘어 뺐다 | 적용 안 함 |
| `events(created_at)` | 활동 보고용으로 시험했지만 플래너가 이 인덱스로 이력 15만 건을 읽는 계획을 골라 오히려 느려졌다 | 적용 안 함 |
| 데이터셋 테이블 인덱스 | 차트는 대부분 전체 스캔·집계이고 split·필터 컬럼은 사용자마다 다르다. 데이터 표(split 조합 한 페이지)만 인덱스 이득이 있다 | 적용 안 함 |

## 바꾼 것

- `server/feed/ddl.ts`: `FEED_INDEXES_V2` (B-tree 11개 + trigram GIN 4개, `pg_trgm`을 `feed` 스키마에). `FEED_SCHEMA_VERSION` 1 → 2.
- `server/feed/migrate.ts`: v1 DB는 **데이터를 지우지 않고** v2 인덱스만 더한다 (그 밖의 버전 차이는 예전처럼 리셋). `analyzeFeed`, 통계 없는 테이블이 있으면 부팅할 때 한 번 ANALYZE.
- `server/db/database.ts`: `PGLITE_EXTENSIONS`(pg_trgm), `PLANNER_SETTINGS`(`random_page_cost = 1.1`, `work_mem = 64MB`). DB Worker가 부팅할 때 적용하고, 테스트 DB·벤치마크도 같은 설정을 쓴다.
- `server/workers/db.worker.ts`: `feedFlush`(시드·리셋·가져오기 뒤)에서 ANALYZE.
- `server/data/datasets.ts`: 적재 뒤 ANALYZE, 통계 없는 예전 데이터셋은 열 때 한 번 ANALYZE.
- `server/data/dataset-schema.ts`: `numericSql`의 시각 식을 `date_part` 기반으로 (값은 그대로).
- `server/data/chart-data.ts`: `queryChartData`가 split 조합마다 한 행으로 묶어 받는다 (결과 모양은 그대로).
- `server/feed/access.ts`, `views.ts`, `groups.ts`: `groupRoles`로 N+1 제거.
- `scripts/bench-db/`: 벤치마크(`pnpm bench:db`), 대량 픽스처, 결과 비교.

## 결과 (중앙값, ms)

### 피드

| 케이스 | 전 | 후 | 배율 | 문장 수 |
| --- | ---: | ---: | ---: | ---: |
| posts.query 탐색(최근 수정순 50) | 223 | 60.4 | 3.7× | 10 |
| posts.query 홈(고정 먼저) | 215 | 92.2 | 2.3× | 10 |
| posts.query 2페이지(offset 1000) | 210 | 58.9 | 3.6× | 10 |
| posts.query 그룹+상태 | 121 | 19.5 | 6.2× | 10 |
| posts.query 내 담당(열림) | 124 | 17.8 | 7.0× | 10 |
| posts.query 이해관계자 | 131 | 22.6 | 5.8× | 10 |
| posts.query 관심(팔로우) | 299 | 23.2 | 12.9× | 10 |
| posts.query 태그 | 183 | 56.3 | 3.2× | 10 |
| posts.query 기한순 | 143 | 34.3 | 4.2× | 10 |
| posts.query 키순 | 184 | 93.7 | 2.0× | 10 |
| posts.query 상태순 | 187 | 97.2 | 1.9× | 10 |
| posts.query 기한 초과 | 137 | 45.5 | 3.0× | 10 |
| posts.query 글자(q) | 876 | 218 | 4.0× | 10 |
| posts.query 보드 500 | 161 | 86.8 | 1.9× | 10 |
| posts.mySummary | 16.8 | 13.6 | 1.2× | 8 |
| posts.get 최근 | 132 | 15.1 | 8.7× | 17 |
| posts.get 오래된 | 138 | 14.9 | 9.3× | 17 |
| comments.list | 53.3 | 6.8 | 7.8× | 8 |
| search.posts 키 (`GA-12`) | 1456 | 29.6 | 49× | 6 |
| search.posts 글자 (`대시보드`) | 1790 | 510 | 3.5× | 6 |
| search.posts 없는 말 | 1516 | 31.5 | 48× | 6 |
| notifications.inbox | 70.7 | 76.9 | 0.92× ※ | 5 |
| notifications.unreadCount | 6.4 | 7.7 | 0.82× ※ | 3 |
| views.list | 322 | 15.7 | 20× | 511 → 4 |
| groups.list | 13.3 | 5.7 | 2.3× | 20 → 4 |
| reports.activity 30일 | 319 | 278 | 1.1× | 6 |
| reports.status | 372 | 189 | 2.0× | 10 |
| scheduler.run | 338 | 143 | 2.4× | 4 |
| posts.create | 149 | 22.4 | 6.7× | 26 |
| comments.create | 16.8 | 16.5 | 1.0× | 21 |
| posts.update 우선순위 | 156 | 17.7 | 8.8× | 21 |
| notifications.markRead | 27.9 | 26.4 | 1.1× | 9 |

※ 이 측정에는 뒤에 뺀 `notifications(user_id, created_at)` 인덱스가 들어 있었다. 뺀 뒤에는 전과 같은 계획(`notifications(user_id, read_at)`)으로 돌아간다. unreadCount는 전후 계획이 같아 잡음이다.

`search.posts 글자`는 픽스처 어휘가 30단어뿐이라 `대시보드`가 댓글의 32%에 들어 있어(6.4만 건) 맞은 행을 모두 읽는다. 실제 검색어처럼 드문 말은 `없는 말`(31ms)에 가깝다.

### 차트 데이터 (100만 행)

| 케이스 | 전 | 후 | 배율 |
| --- | ---: | ---: | ---: |
| scatter ts×value | 11967 | 3193 | 3.7× |
| scatter split factory×line + legend | 21225 | 4404 | 4.8× |
| scatter ts 1주 필터 | 5974 | 1287 | 4.6× |
| heatmap ts×machine avg | 3071 | 2064 | 1.5× |
| columnSummary ts | 1008 | 768 | 1.3× |
| itemRows split 조합 1페이지 | 625 | 508 | 1.2× |
| boxplot value by sensor_type | 3378 | 3124 | 1.1× |
| histogram value split sensor | 934 | 868 | 1.1× |
| sampleRows 필터 1페이지 | 1050 | 972 | 1.1× |
| bar avg / median, splitCount, legendValues, columnSummary(범주) | 359~1894 | 350~1834 | 1.0× (±10%, 잡음) |

범주 집계(bar·splitCount·legendValues)는 100만 행 순차 스캔 자체가 시간의 대부분(약 0.3초)이라 설정으로 줄지 않는다.

### 비용

| 항목 | 값 |
| --- | --- |
| 부팅 | pg_trgm 확장 로드 +약 20ms (PGlite 생성 2.4~3초 중) |
| 인덱스 크기 | trigram 4개 약 25MB (피드 전체 600MB 중), B-tree는 테이블 크기에 비례 |
| 쓰기 | posts.create·comments.create·update는 전보다 빠르거나 같다 (읽기 쪽 이득이 인덱스 유지 비용보다 크다) |
| 대량 적재 | 픽스처 COPY 170초 → 216초 (+27%, 인덱스 유지). 시드는 기본 시나리오(수십 건)라 체감 없다 |
| ANALYZE | 픽스처 전체 3.9초. 시드·가져오기 뒤에만 돈다 (기본 시나리오 23ms) |
| 기존 사용자 | 피드 v1 DB는 데이터를 두고 인덱스만 더한다. 데이터셋은 처음 열 때 한 번 ANALYZE (100만 행 356ms) |

브라우저 확인: 프로덕션 빌드(`output: export`)를 Chromium에서 띄워 DB Worker가 pg_trgm을 읽고 v2 스키마를 만든 뒤, 시드·검색 API가 정상 응답하는 것을 확인했다 (`pg_trgm.tar.gz`는 해시가 붙은 이름으로 내보내지고, PGlite는 이름이 아니라 내용으로 gzip을 푼다).

## 남은 과제 (이번에 고치지 않음)

1. **목록 전체 개수**: `posts.query`는 매번 `count(*)`로 볼 수 있는 게시물을 전부 센다 (4.2만 행 30~50ms, 탐색 60ms의 절반). 개수가 꼭 정확해야 하는지, 어림값(`EXPLAIN` 행 수)이나 "1000+" 표시로 충분한지 화면 결정이 필요하다.
2. **페이지 없는 응답**: `notifications.inbox`는 사용자의 알림을 전부(픽스처에서 1,500건), `reports.status`는 열린 게시물 요약을 전부, `reports.activity`는 기간의 이력을 전부(8,500건) 돌려준다. 이제 남은 시간은 계획이 아니라 결과 크기다.
3. **본문 검색이 JSON 글자를 본다**: `body::text ilike`라 Tiptap의 키(`type`, `paragraph`, `text` …)도 맞는다. `search.posts`는 글만 뽑아 다시 확인하므로 결과는 맞지만, `posts.query`의 `q` 필터는 `text` 같은 말로 거르면 모든 게시물이 맞는다. 글만 담은 생성 컬럼(또는 trigger)과 그 위의 trigram 인덱스가 근본 해결이다.
4. **두 글자 검색**: trigram은 세 글자부터 인덱스를 쓴다. 한국어는 두 글자 말이 많아(`센서`, `진동`) 이때는 예전처럼 순차 스캔이다.
5. **VACUUM이 돌지 않는다**: autovacuum이 없어 update·delete가 남긴 죽은 행이 쌓이고(알림 읽음 처리, 게시물 수정), visibility map이 비어 인덱스 전용 스캔을 못 쓴다. 한가할 때 `vacuum`을 부르는 정책을 따로 정할 만하다.
6. **`notifications.event_id` 인덱스 없음**: 지금은 이력을 하나씩 지우는 곳이 없어(리셋은 스키마를 통째로 지운다) 넣지 않았다. 이력을 지우는 기능이 생기면 외래 키 검사가 알림 220만 행을 행마다 스캔하므로 함께 넣는다.
7. **알림 생성**: `dispatchEvent`가 받는 사람마다 insert를 따로 한다. 지금 규모(구독자 몇 명)에서는 16ms 안이지만, 구독자가 많아지면 한 번에 넣는 편이 낫다.
8. **차트 행 id**: `ctid::text::point` 변환이 10만 행에 약 0.15초다. 행 id가 꼭 ctid여야 하는지(적재 때 `bigint` 행 번호 컬럼을 두면 변환이 없다) 정할 만하다.
9. **상자 그림**: 사분위수 CTE를 원본과 다시 조인해 이상값을 고르느라 100만 행을 두 번 읽는다 (3.1초). 쿼리 구조를 바꾸는 일이라 이번 범위에서 뺐다.
