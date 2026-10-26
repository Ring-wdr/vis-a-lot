import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type { ChartSpec } from "../api/types";
import { createDb, type Db } from "../db/database";
import {
  deleteShare,
  getShare,
  getSharePng,
  listShares,
  openShares,
  saveShare,
  sharePngUrl,
} from "./share-store";

let db: Db;
beforeAll(async () => {
  db = createDb(new PGlite());
  await openShares(db);
  // 두 번 열어도 그대로다 (부팅마다 부른다).
  await openShares(db);
});

const spec = { dataset: "iot-100k", chartType: "scatter" } as ChartSpec;
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const share = (id: string) => ({
  id,
  createdAt: 1_700_000_000_000,
  createdBy: "demo",
  createdByName: "데모 사용자",
  title: "Scatter · 측정 시각 × 측정값",
  dataset: "iot-100k",
  spec,
  restore: { all: { shapes: [], color: "#e34948" } },
  item: { key: "all", label: "전체" },
  image: { width: 351, height: 222 },
  png,
});

describe("공유 저장소", () => {
  it("저장하면 PNG 주소가 붙은 메타를 돌려주고, 다시 읽어도 같다", async () => {
    const saved = await saveShare(db, share("s1"));
    expect(saved).toEqual({
      ...share("s1"),
      png: undefined,
      image: { url: sharePngUrl("s1"), width: 351, height: 222 },
    } as unknown as typeof saved);
    expect(await getShare(db, "s1")).toEqual(saved);
    expect(saved.image.url).toBe("/api/chart/shares/s1/png");
  });

  it("PNG 바이트를 그대로 돌려준다", async () => {
    expect(Array.from((await getSharePng(db, "s1")) ?? [])).toEqual(
      Array.from(png),
    );
    expect(await getSharePng(db, "nope")).toBeNull();
  });

  it("목록은 만든 사용자 것만 최근 순으로", async () => {
    await saveShare(db, { ...share("s3"), createdAt: 1_800_000_000_000 });
    await saveShare(db, { ...share("s4"), createdBy: "other" });
    const ids = (await listShares(db, "demo")).map((s) => s.id);
    expect(ids).toEqual(["s3", "s1"]);
  });

  it("만든 사용자만 지운다", async () => {
    await saveShare(db, share("s2"));
    expect(await deleteShare(db, "s2", "other")).toBe(false);
    expect(await getShare(db, "s2")).not.toBeNull();
    expect(await deleteShare(db, "s2", "demo")).toBe(true);
    expect(await getShare(db, "s2")).toBeNull();
  });
});
