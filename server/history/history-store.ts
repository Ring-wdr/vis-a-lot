// DB Worker 안의 history 저장소. PGlite(IndexedDB)에 저장해 새로고침해도 남는다.

import type { PGlite } from "@electric-sql/pglite";
import type { ChartSpec, HistoryDetail, HistorySummary } from "../api/types";
import { DEFAULT_DATASET, sampleIdOf } from "../data/schema";

type Row = {
  id: string;
  created_at: number;
  updated_at: number;
  dataset: string;
  generator_version: number;
  spec: HistorySummary["spec"];
  status: HistorySummary["status"];
  items: HistoryDetail["items"];
  events: HistoryDetail["events"];
  thumbnail: string | null;
};

const LIST_LIMIT = 50;

export async function openHistory(db: PGlite) {
  await db.exec(`
    create table if not exists history (
      id text primary key,
      created_at double precision not null,
      updated_at double precision not null,
      dataset text not null,
      generator_version int not null,
      spec jsonb not null,
      status text not null,
      items jsonb not null,
      events jsonb not null,
      thumbnail text
    );
    create index if not exists history_updated_at on history (updated_at desc);
  `);
  // 행 수(rows)로 데이터셋을 구분하던 예전 기록: 샘플 데이터셋 id로 옮긴다.
  const legacy = await db.query<{ exists: boolean }>(
    `select exists (select 1 from information_schema.columns
       where table_name = 'history' and column_name = 'rows') as exists`,
  );
  if (legacy.rows[0].exists) {
    await db.exec(`
      alter table history add column if not exists dataset text;
      update history set dataset = case rows
        when 500000 then 'iot-500k' when 1000000 then 'iot-1m' else 'iot-100k' end;
      alter table history alter column dataset set not null;
      alter table history drop column rows;
    `);
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

export async function saveHistory(db: PGlite, entry: HistoryDetail) {
  await db.query(
    `insert into history (id, created_at, updated_at, dataset, generator_version, spec, status, items, events, thumbnail)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict (id) do update set
       updated_at = excluded.updated_at, spec = excluded.spec, status = excluded.status,
       items = excluded.items, events = excluded.events,
       thumbnail = coalesce(excluded.thumbnail, history.thumbnail)`,
    [
      entry.id,
      entry.createdAt,
      entry.updatedAt,
      entry.dataset,
      entry.generatorVersion,
      JSON.stringify(entry.spec),
      entry.status,
      JSON.stringify(entry.items),
      JSON.stringify(entry.events),
      entry.thumbnail ?? null,
    ],
  );
}

export async function listHistory(db: PGlite): Promise<HistorySummary[]> {
  const res = await db.query<Row>(
    `select * from history order by updated_at desc limit ${LIST_LIMIT}`,
  );
  return res.rows.map(summarize);
}

export async function getHistory(
  db: PGlite,
  id: string,
): Promise<HistoryDetail | null> {
  const res = await db.query<Row>("select * from history where id = $1", [id]);
  const row = res.rows[0];
  if (!row) return null;
  return { ...summarize(row), items: row.items, events: row.events };
}
