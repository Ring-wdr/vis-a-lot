import { describe, expect, it } from "vitest";
import type { ChartShareImport } from "@/shared/api/feed/types";
import { buildPayload, linkRows } from "./payload";

const empty = { imageUrl: "", videoUrl: "", language: "", code: "" };

const share: ChartShareImport = {
  shareId: "sh_1",
  title: "온도",
  thumbnail: "data:image/png;base64,AAAA",
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
  createdAt: "2026-10-23T00:00:00.000Z",
};

describe("새 게시물 payload", () => {
  it("차트는 공유의 payload와 PNG를 쓴다", () => {
    expect(buildPayload("chart", empty, share)).toEqual({
      payload: share.payload,
      thumbnail: share.thumbnail,
    });
    expect(buildPayload("chart", empty, undefined)).toEqual({
      payload: null,
      thumbnail: null,
    });
  });

  it("이미지·동영상·코드", () => {
    expect(
      buildPayload("image", { ...empty, imageUrl: " https://x/a.png " }, share),
    ).toEqual({
      payload: { src: "https://x/a.png" },
      thumbnail: "https://x/a.png",
    });
    expect(
      buildPayload("video", { ...empty, videoUrl: "https://v" }, undefined),
    ).toEqual({ payload: { url: "https://v" }, thumbnail: null });
    expect(
      buildPayload("code", { ...empty, code: "select 1;\n\n" }, undefined)
        .payload,
    ).toEqual({ language: "text", code: "select 1;" });
  });

  it("주소가 있는 링크만 첨부한다", () => {
    expect(
      linkRows([
        { name: "문서", url: "https://d" },
        { name: "빈", url: " " },
        { name: "", url: "https://e" },
      ]),
    ).toEqual([
      { kind: "link", name: "문서", url: "https://d" },
      { kind: "link", name: "https://e", url: "https://e" },
    ]);
  });
});
