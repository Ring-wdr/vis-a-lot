import { describe, expect, it } from "vitest";
import type { ColumnInfo } from "@/shared/api/types";
import { columnLookup } from "./format";

const column = (name: string, label: string, type: ColumnInfo["type"]) =>
  ({ name, label, type }) as ColumnInfo;

describe("columnLookup", () => {
  it("같은 이름의 컬럼도 데이터셋 스키마마다 따로 찾는다", () => {
    const a = columnLookup([column("value", "측정값", "numeric")]);
    const b = columnLookup([column("value", "상태 코드", "categorical")]);
    expect(a.label("value")).toBe("측정값");
    expect(a.type("value")).toBe("numeric");
    expect(b.label("value")).toBe("상태 코드");
    expect(b.type("value")).toBe("categorical");
  });

  it("스키마를 아직 받지 않았으면 이름을 그대로 쓴다", () => {
    const empty = columnLookup();
    expect(empty.label("machine")).toBe("machine");
    expect(empty.type("machine")).toBe("categorical");
  });
});
