// 피드 테이블 타입과 Kysely 인스턴스. vis-a-lot DB Worker의 PGlite를 같이 쓰고 `feed` 스키마만 본다.
// jsonb 컬럼은 읽으면 값이고 쓸 때는 JSON 글자다. 날짜는 PGlite가 Date로 읽으므로 경계에서 문자열로 바꾼다(./time.ts).

import type { PGlite } from "@electric-sql/pglite";
import {
  type ColumnType,
  Kysely,
  PGliteDialect,
  type Transaction,
} from "kysely";

type Json<T> = ColumnType<T, string, string>;
type NullableJson<T> = ColumnType<T | null, string | null, string | null>;
/** timestamptz: 읽으면 Date, 쓸 때는 Date나 ISO 문자열 */
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;
/** date(YYYY-MM-DD): 읽으면 Date, 쓸 때는 'YYYY-MM-DD' */
type NullableDay = ColumnType<
  Date | null,
  string | null | undefined,
  string | null
>;

export type PostStatus =
  | "unresolved"
  | "in_progress"
  | "in_review"
  | "resolved"
  | "on_hold"
  | "cancelled";
export type PostFormat = "chart" | "image" | "video" | "code";
export type RelationKind = "blocks" | "duplicate" | "relates" | "derived";
export type GroupRole = "admin" | "member";
export type ViewLayout = "feed" | "list" | "board";

export interface MetaTable {
  key: string;
  value: string;
}
export interface UsersTable {
  id: string;
  name: string;
  email: string | null;
  is_admin: ColumnType<boolean, boolean | undefined, boolean>;
  active: ColumnType<boolean, boolean | undefined, boolean>;
}
export interface GroupsTable {
  id: string;
  name: string;
  key_prefix: string;
  description: string | null;
  is_private: ColumnType<boolean, boolean | undefined, boolean>;
  next_seq: ColumnType<number, number | undefined, number>;
  status_names: ColumnType<
    Partial<Record<PostStatus, string>>,
    string | undefined,
    string
  >;
  created_by: string | null;
}
export interface GroupMembersTable {
  group_id: string;
  user_id: string;
  role: GroupRole;
}
export interface TeamsTable {
  id: string;
  group_id: string;
  name: string;
}
export interface PostTypesTable {
  id: string;
  group_id: string;
  name: string;
  color: string | null;
  sort: ColumnType<number, number | undefined, number>;
}
export interface PostsTable {
  id: string;
  group_id: string;
  seq: number;
  key: string;
  team_id: string | null;
  post_type_id: string | null;
  format: PostFormat;
  title: string;
  body: NullableJson<unknown>;
  status: ColumnType<PostStatus, PostStatus | undefined, PostStatus>;
  priority: ColumnType<number, number | undefined, number>;
  progress: ColumnType<number, number | undefined, number>;
  author_id: string;
  assignee_id: string | null;
  requester_id: string | null;
  parent_id: string | null;
  due_date: NullableDay;
  hold_until: NullableDay;
  close_reason: string | null;
  reopen_count: ColumnType<number, number | undefined, number>;
  thumbnail: string | null;
  payload: NullableJson<unknown>;
  tags: ColumnType<string[], string[] | undefined, string[]>;
  pinned_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  resolved_at: NullableTimestamp;
  deleted_at: NullableTimestamp;
}
export interface PostUsersTable {
  post_id: string;
  user_id: string;
}
export interface PostSubscribersTable extends PostUsersTable {
  muted: ColumnType<boolean, boolean | undefined, boolean>;
}
export interface ChecklistItemsTable {
  id: string;
  post_id: string;
  text: string;
  done: ColumnType<boolean, boolean | undefined, boolean>;
  sort: ColumnType<number, number | undefined, number>;
}
export interface PostRelationsTable {
  from_id: string;
  to_id: string;
  kind: RelationKind;
}
export interface AttachmentsTable {
  id: string;
  post_id: string;
  kind: "file" | "link";
  name: string;
  url: string;
}
export interface UserFollowsTable {
  follower_id: string;
  followee_id: string;
}
export interface CommentsTable {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: NullableJson<unknown>;
  resolved: ColumnType<boolean, boolean | undefined, boolean>;
  pinned: ColumnType<boolean, boolean | undefined, boolean>;
  created_at: Timestamp;
  updated_at: NullableTimestamp;
  deleted_at: NullableTimestamp;
}
export interface ReactionsTable {
  comment_id: string;
  user_id: string;
  emoji: string;
}
export interface PollsTable {
  id: string;
  comment_id: string;
  question: string;
  options: Json<string[]>;
  closes_at: NullableTimestamp;
}
export interface PollVotesTable {
  poll_id: string;
  user_id: string;
  option_idx: number;
}
export interface EventsTable {
  id: string;
  post_id: string;
  actor_id: string;
  kind: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  comment_id: string | null;
  created_at: Timestamp;
}
export interface NotificationsTable {
  id: string;
  user_id: string;
  event_id: string;
  read_at: NullableTimestamp;
  archived_at: NullableTimestamp;
  created_at: Timestamp;
}
export interface NotificationSettingsTable {
  user_id: string;
  event_kind: string;
  inapp: ColumnType<boolean, boolean | undefined, boolean>;
  slack: ColumnType<boolean, boolean | undefined, boolean>;
  email: ColumnType<boolean, boolean | undefined, boolean>;
}
export interface OutboxTable {
  id: string;
  channel: "slack" | "email";
  recipient: string;
  subject: string | null;
  body: string;
  created_at: Timestamp;
}
export interface SavedViewsTable {
  id: string;
  owner_id: string;
  group_id: string | null;
  name: string;
  shared: ColumnType<boolean, boolean | undefined, boolean>;
  layout: ViewLayout;
  filter: Json<unknown>;
  sort: NullableJson<unknown>;
  group_by: string | null;
  pinned: ColumnType<boolean, boolean | undefined, boolean>;
}
export interface ReportTemplatesTable {
  id: string;
  owner_id: string;
  group_id: string;
  name: string;
  kind: "activity" | "status";
  params: Json<unknown>;
}

export interface FeedDatabase {
  meta: MetaTable;
  users: UsersTable;
  groups: GroupsTable;
  group_members: GroupMembersTable;
  teams: TeamsTable;
  post_types: PostTypesTable;
  posts: PostsTable;
  post_stakeholders: PostUsersTable;
  post_subscribers: PostSubscribersTable;
  checklist_items: ChecklistItemsTable;
  post_relations: PostRelationsTable;
  attachments: AttachmentsTable;
  user_follows: UserFollowsTable;
  comments: CommentsTable;
  reactions: ReactionsTable;
  polls: PollsTable;
  poll_votes: PollVotesTable;
  events: EventsTable;
  notifications: NotificationsTable;
  notification_settings: NotificationSettingsTable;
  outbox: OutboxTable;
  saved_views: SavedViewsTable;
  report_templates: ReportTemplatesTable;
}

/** 피드 쿼리 빌더. 트랜잭션 안에서도 같은 타입으로 쓴다. */
export type FeedDb = Kysely<FeedDatabase> | Transaction<FeedDatabase>;

export function createFeedDb(pglite: PGlite): Kysely<FeedDatabase> {
  return new Kysely<FeedDatabase>({
    dialect: new PGliteDialect({ pglite }),
  }).withSchema("feed");
}
