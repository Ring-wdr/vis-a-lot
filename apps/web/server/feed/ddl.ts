// 피드 DDL. vis-a-lot과 같은 PGlite에 `feed` 스키마로 따로 둔다 (테이블 이름이 vis-a-lot과 겹치지 않게).
// 실제 Postgres로 옮겨도 그대로 실행된다(pg_trgm은 Postgres 기본 contrib). 스키마를 바꾸면 FEED_SCHEMA_VERSION을 올린다.
// 인덱스 근거와 측정값은 docs/db-performance.md에 있다.

export const FEED_SCHEMA_VERSION = 2;

/**
 * v2에서 더한 인덱스. Postgres는 외래 키 컬럼에 인덱스를 만들지 않으므로, 게시물 하나·사용자 하나로
 * 자식 행을 찾는 곳(댓글·하위 이슈·관계·체크리스트 …)마다 둔다. v1 DB는 지우지 않고 이것만 더한다(migrate.ts).
 */
export const FEED_INDEXES_V2 = /* sql */ `
set search_path to feed;
-- 글자 검색(ilike '%…%')용 trigram. 세 글자 이상이면 인덱스를 쓴다
create extension if not exists pg_trgm with schema feed;

-- 게시물 상세·목록 요약이 게시물 id로 모으는 자식 행
create index if not exists comments_post_id_created_at_idx on comments (post_id, created_at);
create index if not exists posts_parent_id_idx on posts (parent_id);
create index if not exists post_relations_to_id_idx on post_relations (to_id);
create index if not exists checklist_items_post_id_idx on checklist_items (post_id);
create index if not exists attachments_post_id_idx on attachments (post_id);
create index if not exists polls_comment_id_idx on polls (comment_id);
-- 사람 기준 필터: 이해관계자(mine=stakeholder), 관심(followedAuthors), 내 뷰
create index if not exists post_stakeholders_user_id_idx on post_stakeholders (user_id);
create index if not exists posts_author_id_idx on posts (author_id);
create index if not exists saved_views_owner_id_idx on saved_views (owner_id);
-- 기본 정렬(최근 수정순)은 앞 몇 건만 읽고 멈춘다
create index if not exists posts_updated_at_idx on posts (updated_at);
-- scheduler가 오늘 만든 기한 알림을 찾는다
create index if not exists events_kind_created_at_idx on events (kind, created_at);
-- 검색(search.posts)과 목록 글자 필터(posts.query q)
create index if not exists posts_key_trgm_idx on posts using gin (key gin_trgm_ops);
create index if not exists posts_title_trgm_idx on posts using gin (title gin_trgm_ops);
create index if not exists posts_body_trgm_idx on posts using gin ((body::text) gin_trgm_ops);
create index if not exists comments_body_trgm_idx on comments using gin ((body::text) gin_trgm_ops);
reset search_path;
`;

export const FEED_DDL = /* sql */ `
create schema if not exists feed;
set search_path to feed;

create table meta (
  key text primary key,
  value text not null
);

-- 사용자·조직
create table users (
  id text primary key,
  name text not null,
  email text,
  is_admin boolean not null default false,
  active boolean not null default true
);
create table groups (
  id text primary key,
  name text not null,
  key_prefix text not null unique,          -- 이슈 키 접두사, 예: FD
  description text,
  is_private boolean not null default false,
  next_seq int not null default 1,
  status_names jsonb not null default '{}',  -- 그룹별 상태 이름 {"in_review":"승인 대기"}. 카테고리는 고정
  created_by text references users(id)
);
create table group_members (
  group_id text references groups(id),
  user_id text references users(id),
  role text not null check (role in ('admin','member')),
  primary key (group_id, user_id)
);
create table teams (
  id text primary key,
  group_id text not null references groups(id),
  name text not null
);
create table post_types (                   -- 게시물 유형(라벨)
  id text primary key,
  group_id text not null references groups(id),
  name text not null,
  color text,
  sort int not null default 0
);

-- 게시물
create table posts (
  id text primary key,
  group_id text not null references groups(id),
  seq int not null,
  key text not null unique,                 -- 만들 때의 key_prefix || '-' || seq. 접두사를 바꿔도 유지
  team_id text references teams(id),
  post_type_id text references post_types(id),
  format text not null check (format in ('chart','image','video','code')),
  title text not null,
  body jsonb,                               -- Tiptap JSON
  status text not null default 'unresolved'
    check (status in ('unresolved','in_progress','in_review','resolved','on_hold','cancelled')),
  priority int not null default 2,          -- 0 없음 1 낮음 2 보통 3 높음 4 긴급
  progress int not null default 0,
  author_id text not null references users(id),
  assignee_id text references users(id),
  requester_id text references users(id),
  parent_id text references posts(id),
  due_date date,
  hold_until date,                          -- 보류 재개 예정일
  close_reason text,                        -- 취소·보류 사유
  reopen_count int not null default 0,
  thumbnail text,                           -- 대표 이미지(URL 또는 data URL)
  payload jsonb,                            -- 차트 데이터·이미지·동영상 링크·코드
  tags text[] not null default '{}',
  pinned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  deleted_at timestamptz,                   -- 소프트 삭제
  unique (group_id, seq)
);
create table post_stakeholders (
  post_id text references posts(id), user_id text references users(id),
  primary key (post_id, user_id)
);
create table post_subscribers (
  post_id text references posts(id), user_id text references users(id),
  muted boolean not null default false,
  primary key (post_id, user_id)
);
create table checklist_items (
  id text primary key,
  post_id text not null references posts(id),
  text text not null,
  done boolean not null default false,
  sort int not null default 0
);
create table post_relations (
  from_id text references posts(id),
  to_id text references posts(id),
  kind text not null check (kind in ('blocks','duplicate','relates','derived')),
  primary key (from_id, to_id, kind)
);
create table attachments (
  id text primary key,
  post_id text not null references posts(id),
  kind text not null check (kind in ('file','link')),
  name text not null,
  url text not null
);
create table user_follows (                 -- 관심(팔로우)
  follower_id text references users(id), followee_id text references users(id),
  primary key (follower_id, followee_id)
);

-- 협업
create table comments (
  id text primary key,
  post_id text not null references posts(id),
  author_id text not null references users(id),
  parent_id text references comments(id),  -- 대댓글
  body jsonb,                               -- Tiptap JSON(이미지·동영상·코드 포함)
  resolved boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);
create table reactions (
  comment_id text references comments(id), user_id text references users(id), emoji text,
  primary key (comment_id, user_id, emoji)
);
create table polls (
  id text primary key,
  comment_id text not null references comments(id),
  question text not null,
  options jsonb not null,                   -- ["A","B"]
  closes_at timestamptz
);
create table poll_votes (
  poll_id text references polls(id), user_id text references users(id),
  option_idx int not null,
  primary key (poll_id, user_id)
);

-- 이력·알림
create table events (                       -- 변경 이력 = 활동 로그 = 알림 원천
  id text primary key,
  post_id text not null references posts(id),
  actor_id text not null references users(id),
  kind text not null,                       -- created, status, assignee, priority, due, progress, comment, mention,
                                            -- review_requested, approved, rejected, reopened, relation, checklist
  field text, old_value text, new_value text,
  comment_id text references comments(id),
  created_at timestamptz not null default now()
);
create table notifications (
  id text primary key,
  user_id text not null references users(id),
  event_id text not null references events(id),
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table notification_settings (
  user_id text references users(id),
  event_kind text,
  inapp boolean not null default true,
  slack boolean not null default false,
  email boolean not null default false,
  primary key (user_id, event_kind)
);
create table outbox (                       -- 슬랙·이메일 발송 흉내
  id text primary key,
  channel text not null check (channel in ('slack','email')),
  recipient text not null,
  subject text,
  body text not null,
  created_at timestamptz not null default now()
);

-- 뷰·보고서
create table saved_views (
  id text primary key,
  owner_id text not null references users(id),
  group_id text references groups(id),
  name text not null,
  shared boolean not null default false,
  layout text not null check (layout in ('feed','list','board')),
  filter jsonb not null default '{}',
  sort jsonb,
  group_by text,
  pinned boolean not null default false
);
create table report_templates (
  id text primary key,
  owner_id text not null references users(id),
  group_id text not null references groups(id),
  name text not null,
  kind text not null check (kind in ('activity','status')),
  params jsonb not null
);

create index on posts (group_id, status);
create index on posts (assignee_id);
create index on posts (due_date);
create index on events (post_id, created_at);
create index on notifications (user_id, read_at);

reset search_path;
${FEED_INDEXES_V2}`;
