// DB Worker 안의 공유 저장소. 만든 시점의 설정·item 상태와 대표 PNG를 PGlite(IndexedDB)에 고정해 둔다.

import type { Selectable } from "kysely";
import type { Share } from "../api/types";
import type { Db, SharesTable } from "../db/database";

type Row = Selectable<SharesTable>;

const LIST_LIMIT = 100;

/** PNG를 뺀 컬럼. 메타를 읽을 때 큰 바이트를 옮기지 않는다. */
const META = [
  "id",
  "created_at",
  "created_by",
  "created_by_name",
  "title",
  "dataset",
  "spec",
  "restore",
  "item",
  "width",
  "height",
] as const;

/** 저장할 때는 PNG 바이트를 같이 받고, 읽을 때는 메타만 돌려준다 (PNG는 sharePng로 따로). */
export type StoredShare = Omit<Share, "image"> & {
  image: { width: number; height: number };
  png: Uint8Array;
};

export const sharePngUrl = (id: string) =>
  `/api/chart/shares/${encodeURIComponent(id)}/png`;

export async function openShares(db: Db) {
  await db.schema
    .createTable("shares")
    .ifNotExists()
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("created_at", "double precision", (c) => c.notNull())
    .addColumn("created_by", "text", (c) => c.notNull())
    .addColumn("created_by_name", "text", (c) => c.notNull())
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("dataset", "text", (c) => c.notNull())
    .addColumn("spec", "jsonb", (c) => c.notNull())
    .addColumn("restore", "jsonb", (c) => c.notNull())
    .addColumn("item", "jsonb", (c) => c.notNull())
    .addColumn("width", "integer", (c) => c.notNull())
    .addColumn("height", "integer", (c) => c.notNull())
    .addColumn("png", "bytea", (c) => c.notNull())
    .execute();
}

function toShare(row: Omit<Row, "png">): Share {
  return {
    id: row.id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    title: row.title,
    dataset: row.dataset,
    spec: row.spec,
    restore: row.restore,
    item: row.item,
    image: { url: sharePngUrl(row.id), width: row.width, height: row.height },
  };
}

export async function saveShare(db: Db, share: StoredShare): Promise<Share> {
  const row = await db
    .insertInto("shares")
    .values({
      id: share.id,
      created_at: share.createdAt,
      created_by: share.createdBy,
      created_by_name: share.createdByName,
      title: share.title,
      dataset: share.dataset,
      spec: JSON.stringify(share.spec),
      restore: JSON.stringify(share.restore),
      item: JSON.stringify(share.item),
      width: share.image.width,
      height: share.image.height,
      png: share.png,
    })
    .returning(META)
    .executeTakeFirstOrThrow();
  return toShare(row);
}

export async function getShare(db: Db, id: string): Promise<Share | null> {
  const row = await db
    .selectFrom("shares")
    .select(META)
    .where("id", "=", id)
    .executeTakeFirst();
  return row ? toShare(row) : null;
}

export async function listShares(db: Db, createdBy: string): Promise<Share[]> {
  const rows = await db
    .selectFrom("shares")
    .select(META)
    .where("created_by", "=", createdBy)
    .orderBy("created_at", "desc")
    .limit(LIST_LIMIT)
    .execute();
  return rows.map(toShare);
}

export async function getSharePng(
  db: Db,
  id: string,
): Promise<Uint8Array | null> {
  const row = await db
    .selectFrom("shares")
    .select("png")
    .where("id", "=", id)
    .executeTakeFirst();
  return row?.png ?? null;
}

/** 만든 사용자의 공유만 지운다. 지웠으면 true */
export async function deleteShare(db: Db, id: string, createdBy: string) {
  const result = await db
    .deleteFrom("shares")
    .where("id", "=", id)
    .where("created_by", "=", createdBy)
    .executeTakeFirst();
  return Number(result.numDeletedRows) > 0;
}
