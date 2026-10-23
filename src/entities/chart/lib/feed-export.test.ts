import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC } from "@/entities/workspace/model/workspace-store";
import { feedExport, readFeedExport } from "./feed-export";

describe("피드로 보내기", () => {
  const base = {
    shareId: "s1",
    imageUrl: "http://localhost:3000/api/chart/shares/s1/png",
    title: "Scatter · 측정 시각 × 측정값",
    thumbnail: "data:image/png;base64,AAAA",
    link: "http://localhost:3000/#s=abc",
    spec: DEFAULT_SPEC,
    restore: {},
    item: { key: "k1", label: "A", width: 320, height: 240 },
  };

  it("샘플 데이터 차트는 다른 브라우저에서도 열린다", () => {
    const pkg = feedExport({
      ...base,
      dataset: { id: "iot-100k", name: "샘플 10만", kind: "sample" },
    });
    expect(pkg).toMatchObject({
      source: "vis-a-lot",
      v: 1,
      kind: "chart",
      portable: true,
    });
    expect(pkg.payload.spec).toEqual(DEFAULT_SPEC);
  });

  it("업로드 데이터 차트는 portable이 아니다", () => {
    const pkg = feedExport({
      ...base,
      dataset: { id: "up-123", name: "내 파일", kind: "upload" },
    });
    expect(pkg.portable).toBe(false);
  });

  it("JSON으로 왕복하고, 다른 텍스트는 무시한다", () => {
    const pkg = feedExport({
      ...base,
      dataset: { id: "iot-100k", name: "샘플 10만", kind: "sample" },
    });
    expect(readFeedExport(JSON.stringify(pkg))).toEqual(pkg);
    expect(readFeedExport("hello")).toBeUndefined();
    expect(readFeedExport(JSON.stringify({ ...pkg, v: 2 }))).toBeUndefined();
  });
});
