// DB Worker 안의 history 저장소. PGlite(IndexedDB)에 저장해 새로고침해도 남는다.

import { type Selectable, sql } from "kysely";
import type { ChartSpec, HistoryDetail, HistorySummary } from "../api/types";
import { DEFAULT_DATASET, sampleIdOf } from "../data/schema";
import type { Db, HistoryTable } from "../db/database";

type Row = Selectable<HistoryTable>;

const LIST_LIMIT = 50;

export async function openHistory(db: Db) {
  await db.schema
    .createTable("history")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("created_at", "double precision", (c) => c.notNull())
    .addColumn("updated_at", "double precision", (c) => c.notNull())
    .addColumn("dataset", "text", (c) => c.notNull())
    .addColumn("generator_version", "integer", (c) => c.notNull())
    .addColumn("spec", "jsonb", (c) => c.notNull())
    .addColumn("status", "text", (c) => c.notNull())
    .addColumn("items", "jsonb", (c) => c.notNull())
    .addColumn("events", "jsonb", (c) => c.notNull())
    .addColumn("thumbnail", "text")
    .execute();
  await db.schema
    .createIndex("history_updated_at")
    .ifNotExists()
    .on("history")
    .expression(sql`updated_at desc`)
    .execute();
  // 행 수(rows)로 데이터셋을 구분하던 예전 기록: 샘플 데이터셋 id로 옮긴다.
  // information_schema 조회와 컬럼 옮기기는 Postgres 계열 전용 SQL 그대로 둔다.
  const legacy = await sql<{
    exists: boolean;
  }>`select exists (select 1 from information_schema.columns
       where table_name = 'history' and column_name = 'rows') as exists`.execute(
    db,
  );
  if (legacy.rows[0].exists) {
    // 예전에는 exec 한 번(암묵적 트랜잭션 하나)으로 옮겼다. 같은 원자성을 트랜잭션으로 지킨다.
    await db.transaction().execute(async (trx) => {
      await sql`alter table history add column if not exists dataset text`.execute(
        trx,
      );
      await sql`update history set dataset = case rows
        when 500000 then 'iot-500k' when 1000000 then 'iot-1m' else 'iot-100k' end`.execute(
        trx,
      );
      await sql`alter table history alter column dataset set not null`.execute(
        trx,
      );
      await sql`alter table history drop column rows`.execute(trx);
    });
  }
}

/** 예전 기록의 spec에는 dataset 대신 rows가 있다. */
function specOf(row: Row): ChartSpec {
  const spec = row.spec as ChartSpec & { rows?: number };
  if (spec.dataset) return spec;
  const { rows, ...rest } = spec;
  return { ...rest, dataset: sampleIdOf(rows ?? 0) ?? DEFAULT_DATASET };
}

function summarize(row: Row): HistorySummary {
  const items = Object.values(row.items);
  const statusCounts: HistorySummary["statusCounts"] = {};
  for (const item of items) {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  }
  const eventCounts: HistorySummary["eventCounts"] = {};
  for (const event of row.events) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    dataset: row.dataset,
    generatorVersion: row.generator_version,
    spec: specOf(row),
    status: row.status,
    itemCount: items.length,
    statusCounts,
    eventCounts,
    thumbnail: row.thumbnail ?? undefined,
  };
}

export async function saveHistory(db: Db, entry: HistoryDetail) {
  await db
    .insertInto("history")
    .values({
      id: entry.id,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      dataset: entry.dataset,
      generator_version: entry.generatorVersion,
      spec: JSON.stringify(entry.spec),
      status: entry.status,
      items: JSON.stringify(entry.items),
      events: JSON.stringify(entry.events),
      thumbnail: entry.thumbnail ?? null,
    })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        updated_at: eb.ref("excluded.updated_at"),
        spec: eb.ref("excluded.spec"),
        status: eb.ref("excluded.status"),
        items: eb.ref("excluded.items"),
        events: eb.ref("excluded.events"),
        thumbnail: eb.fn.coalesce(
          eb.ref("excluded.thumbnail"),
          eb.ref("history.thumbnail"),
        ),
      })),
    )
    .execute();
}

export async function listHistory(db: Db): Promise<HistorySummary[]> {
  const rows = await db
    .selectFrom("history")
    .selectAll()
    .orderBy("updated_at", "desc")
    .limit(LIST_LIMIT)
    .execute();
  return rows.map(summarize);
}

/** history 한 건을 지운다. 없던 건이면 false */
export async function deleteHistory(db: Db, id: string) {
  const result = await db
    .deleteFrom("history")
    .where("id", "=", id)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}

export async function getHistory(
  db: Db,
  id: string,
): Promise<HistoryDetail | null> {
  const row = await db
    .selectFrom("history")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  return { ...summarize(row), items: row.items, events: row.events };
}
