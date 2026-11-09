// 피드 스냅숏(JSON 백업·복원). 테이블 목록은 부모 먼저 순서이고, 지울 때는 거꾸로 지운다.
// 행은 평범한 JSON이다: 시각은 ISO 문자열, date는 'YYYY-MM-DD', jsonb는 값 그대로.

import type { Kysely, Transaction } from "kysely";
import { FeedError } from "../context";
import type { FeedDatabase } from "../db";
import { FEED_SCHEMA_VERSION } from "../ddl";
import { day, iso } from "../time";

export type FeedTableName = Exclude<keyof FeedDatabase, "meta">;
export type SnapshotRow = Record<string, unknown>;
export type SnapshotTables = Partial<Record<FeedTableName, SnapshotRow[]>>;

export type FeedSnapshot = {
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, SnapshotRow[]>;
};

type TableSpec = {
  name: FeedTableName;
  columns: string[];
  /** 정렬 기준(기본 키) */
  key: string[];
  json?: string[];
  days?: string[];
  /** 같은 테이블을 가리키는 부모 컬럼. 부모 행을 먼저 넣는다 */
  selfParent?: string;
};

/** 부모 먼저 순서 (FK 순서) */
export const FEED_TABLES: TableSpec[] = [
  {
    name: "users",
    columns: ["id", "name", "email", "is_admin", "active"],
    key: ["id"],
  },
  {
    name: "groups",
    columns: [
      "id",
      "name",
      "key_prefix",
      "description",
      "is_private",
      "next_seq",
      "status_names",
      "created_by",
    ],
    key: ["id"],
    json: ["status_names"],
  },
  {
    name: "group_members",
    columns: ["group_id", "user_id", "role"],
    key: ["group_id", "user_id"],
  },
  { name: "teams", columns: ["id", "group_id", "name"], key: ["id"] },
  {
    name: "post_types",
    columns: ["id", "group_id", "name", "color", "sort"],
    key: ["id"],
  },
  {
    name: "posts",
    columns: [
      "id",
      "group_id",
      "seq",
      "key",
      "team_id",
      "post_type_id",
      "format",
      "title",
      "body",
      "status",
      "priority",
      "progress",
      "author_id",
      "assignee_id",
      "requester_id",
      "parent_id",
      "due_date",
      "hold_until",
      "close_reason",
      "reopen_count",
      "thumbnail",
      "payload",
      "tags",
      "pinned_at",
      "created_at",
      "updated_at",
      "resolved_at",
      "deleted_at",
    ],
    key: ["id"],
    json: ["body", "payload"],
    days: ["due_date", "hold_until"],
    selfParent: "parent_id",
  },
  {
    name: "post_stakeholders",
    columns: ["post_id", "user_id"],
    key: ["post_id", "user_id"],
  },
  {
    name: "post_subscribers",
    columns: ["post_id", "user_id", "muted"],
    key: ["post_id", "user_id"],
  },
  {
    name: "checklist_items",
    columns: ["id", "post_id", "text", "done", "sort"],
    key: ["id"],
  },
  {
    name: "post_relations",
    columns: ["from_id", "to_id", "kind"],
    key: ["from_id", "to_id", "kind"],
  },
  {
    name: "attachments",
    columns: ["id", "post_id", "kind", "name", "url"],
    key: ["id"],
  },
  {
    name: "user_follows",
    columns: ["follower_id", "followee_id"],
    key: ["follower_id", "followee_id"],
  },
  {
    name: "comments",
    columns: [
      "id",
      "post_id",
      "author_id",
      "parent_id",
      "body",
      "resolved",
      "pinned",
      "created_at",
      "updated_at",
      "deleted_at",
    ],
    key: ["id"],
    json: ["body"],
    selfParent: "parent_id",
  },
  {
    name: "reactions",
    columns: ["comment_id", "user_id", "emoji"],
    key: ["comment_id", "user_id", "emoji"],
  },
  {
    name: "polls",
    columns: ["id", "comment_id", "question", "options", "closes_at"],
    key: ["id"],
    json: ["options"],
  },
  {
    name: "poll_votes",
    columns: ["poll_id", "user_id", "option_idx"],
    key: ["poll_id", "user_id"],
  },
  {
    name: "events",
    columns: [
      "id",
      "post_id",
      "actor_id",
      "kind",
      "field",
      "old_value",
      "new_value",
      "comment_id",
      "created_at",
    ],
    key: ["id"],
  },
  {
    name: "notifications",
    columns: [
      "id",
      "user_id",
      "event_id",
      "read_at",
      "archived_at",
      "created_at",
    ],
    key: ["id"],
  },
  {
    name: "notification_settings",
    columns: ["user_id", "event_kind", "inapp", "slack", "email"],
    key: ["user_id", "event_kind"],
  },
  {
    name: "outbox",
    columns: ["id", "channel", "recipient", "subject", "body", "created_at"],
    key: ["id"],
  },
  {
    name: "saved_views",
    columns: [
      "id",
      "owner_id",
      "group_id",
      "name",
      "shared",
      "layout",
      "filter",
      "sort",
      "group_by",
      "pinned",
    ],
    key: ["id"],
    json: ["filter", "sort"],
  },
  {
    name: "report_templates",
    columns: ["id", "owner_id", "group_id", "name", "kind", "params"],
    key: ["id"],
    json: ["params"],
  },
];

const SPEC_BY_NAME = new Map(FEED_TABLES.map((t) => [t.name as string, t]));

// 동적 테이블 이름을 다루므로 행 타입 검사는 스냅숏 검증에 맡긴다.
// biome-ignore lint/suspicious/noExplicitAny: 테이블마다 행 타입이 다르다
type AnyDb = Kysely<any> | Transaction<any>;

function toJsonValue(spec: TableSpec, column: string, value: unknown) {
  if (value instanceof Date)
    return spec.days?.includes(column) ? day(value) : iso(value);
  return value;
}

/** 피드 테이블 전체를 스냅숏 행으로 읽는다 (meta 제외, 기본 키 순) */
export async function exportTables(db: AnyDb) {
  const tables: Record<string, SnapshotRow[]> = {};
  for (const spec of FEED_TABLES) {
    let query = db.selectFrom(spec.name).select(spec.columns);
    for (const k of spec.key) query = query.orderBy(k);
    const rows: SnapshotRow[] = await query.execute();
    tables[spec.name] = rows.map((row) =>
      Object.fromEntries(
        spec.columns.map((c) => [c, toJsonValue(spec, c, row[c])]),
      ),
    );
  }
  return tables;
}

/** 피드 행을 모두 지운다 (자식 먼저) */
export async function clearTables(db: AnyDb) {
  for (const spec of [...FEED_TABLES].reverse())
    await db.deleteFrom(spec.name).execute();
}

/** 같은 테이블의 부모 행이 먼저 오게 줄 세운다 */
function parentFirst(rows: SnapshotRow[], column: string) {
  const ids = new Set(rows.map((r) => r.id));
  const done = new Set<unknown>();
  const out: SnapshotRow[] = [];
  let rest = rows;
  while (rest.length > 0) {
    const ready = rest.filter((r) => {
      const parent = r[column];
      return parent == null || !ids.has(parent) || done.has(parent);
    });
    // 순환이면 남은 것을 그대로 넣고 DB가 거르게 한다
    const batch = ready.length > 0 ? ready : rest;
    for (const r of batch) {
      out.push(r);
      done.add(r.id);
    }
    rest = rest.filter((r) => !batch.includes(r));
  }
  return out;
}

/** 스냅숏 행을 부모 먼저 넣는다. jsonb 컬럼은 JSON 글자로 바꾼다. 넣은 행 수를 돌려준다 */
export async function insertTables(db: AnyDb, tables: SnapshotTables) {
  let total = 0;
  for (const spec of FEED_TABLES) {
    let rows = tables[spec.name] ?? [];
    if (rows.length === 0) continue;
    if (spec.selfParent) rows = parentFirst(rows, spec.selfParent);
    const values = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([c, v]) => [
          c,
          spec.json?.includes(c) && v != null ? JSON.stringify(v) : v,
        ]),
      ),
    );
    for (let i = 0; i < values.length; i += 200)
      await db
        .insertInto(spec.name)
        .values(values.slice(i, i + 200))
        .execute();
    total += rows.length;
  }
  return total;
}

/** 버전·테이블·컬럼을 확인한다. 틀리면 400 */
export function validateSnapshot(snapshot: FeedSnapshot): SnapshotTables {
  if (snapshot?.schemaVersion !== FEED_SCHEMA_VERSION)
    throw new FeedError(
      400,
      `스키마 버전이 다릅니다: ${snapshot?.schemaVersion} (지금 ${FEED_SCHEMA_VERSION})`,
    );
  if (typeof snapshot.tables !== "object" || snapshot.tables === null)
    throw new FeedError(400, "tables가 없습니다");
  for (const [name, rows] of Object.entries(snapshot.tables)) {
    const spec = SPEC_BY_NAME.get(name);
    if (!spec) throw new FeedError(400, `모르는 테이블입니다: ${name}`);
    if (!Array.isArray(rows))
      throw new FeedError(400, `${name}의 행이 배열이 아닙니다`);
    for (const row of rows)
      for (const column of Object.keys(row))
        if (!spec.columns.includes(column))
          throw new FeedError(400, `모르는 컬럼입니다: ${name}.${column}`);
  }
  return snapshot.tables as SnapshotTables;
}
