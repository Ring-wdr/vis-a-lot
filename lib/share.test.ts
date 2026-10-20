import { describe, expect, it } from "vitest";
import type { HistoryDetail } from "@/server/api/types";
import { encodeShareHash, readShareHash, restoreOf } from "./share";
import { DEFAULT_SPEC } from "./workspace-store";

describe("공유 링크", () => {
  const restore = {
    k1: {
      view: { x: [1, 2] as [number, number], y: [3, 4] as [number, number] },
      shapes: [{ type: "text" as const, x: 1.5, y: 3.5, text: "점검 필요" }],
      color: "#e34948",
    },
  };

  it("설정과 item 상태를 hash로 왕복한다", () => {
    const hash = encodeShareHash({ spec: DEFAULT_SPEC, restore });
    expect(hash.startsWith("#s=")).toBe(true);
    expect(readShareHash(hash)).toEqual({ spec: DEFAULT_SPEC, restore });
  });

  it("다른 hash나 깨진 값은 무시한다", () => {
    expect(readShareHash("#other")).toBeUndefined();
    expect(readShareHash("#s=broken!!")).toBeUndefined();
  });

  it("history에서 바뀐 item만 복원 대상으로 꺼낸다", () => {
    const detail = {
      items: {
        k1: { label: "A", status: "success", ...restore.k1 },
        k2: { label: "B", status: "cancelled", shapes: [] },
      },
    } as unknown as HistoryDetail;
    expect(restoreOf(detail)).toEqual(restore);
  });
});
