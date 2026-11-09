// imports API: chart 서비스 공유 → 차트 게시물 입력. DB Worker 호출(shareGet·sharePng)을 흉내 낸다.

import { beforeEach, describe, expect, it, vi } from "vitest";

const shares = new Map<string, unknown>();
const pngs = new Map<string, Uint8Array>();

vi.mock("../../../../runtime", () => ({
  getRuntime: () => ({
    db: {
      call: async (method: string, { id }: { id: string }) => {
        if (method === "shareGet") return shares.get(id) ?? null;
        if (method === "sharePng") return pngs.get(id) ?? null;
        throw new Error(`unexpected ${method}`);
      },
    },
  }),
}));

const { feedApp } = await import("../../app");
const { toBase64 } = await import("./handlers");

const get = (id: string) =>
  feedApp.request(`/imports/chart-shares/${id}`, {
    headers: { "x-feed-user": "u1" },
  });

beforeEach(() => {
  shares.clear();
  pngs.clear();
});

describe("imports API", () => {
  it("공유를 차트 게시물 입력으로 바꾼다", async () => {
    shares.set("sh_1", {
      id: "sh_1",
      createdAt: Date.UTC(2026, 9, 20, 3),
      createdBy: "demo",
      createdByName: "데모",
      title: "온도 막대",
      dataset: "iot-100k",
      spec: { dataset: "iot-100k", chartType: "bar" },
      restore: {},
      item: { key: "all", label: "전체" },
      image: { url: "/api/chart/shares/sh_1/png", width: 10, height: 10 },
    });
    pngs.set("sh_1", new Uint8Array([137, 80, 78, 71]));

    const res = await get("sh_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      shareId: "sh_1",
      title: "온도 막대",
      thumbnail: "data:image/png;base64,iVBORw==",
      link: "/share?id=sh_1",
      payload: {
        source: "vis-a-lot",
        shareId: "sh_1",
        link: "/share?id=sh_1",
        chartType: "bar",
        dataset: "iot-100k",
        item: { key: "all", label: "전체" },
      },
      createdByName: "데모",
      createdAt: "2026-10-20T03:00:00.000Z",
    });
  });

  it("모르는 공유는 404", async () => {
    const res = await get("nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("error");
  });

  it("큰 PNG도 나눠서 base64로 바꾼다", () => {
    const bytes = new Uint8Array(300_000).map((_, i) => i % 256);
    const encoded = toBase64(bytes);
    expect(Buffer.from(encoded, "base64").equals(Buffer.from(bytes))).toBe(
      true,
    );
  });
});
