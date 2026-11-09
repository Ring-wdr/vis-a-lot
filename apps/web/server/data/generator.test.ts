import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateCsvChunks, SENSOR_COUNT, shiftOf } from "./generator";
import { COLUMNS } from "./schema";

function collect(rows: 100_000) {
  const hash = createHash("sha256");
  const lines: string[] = [];
  let count = 0;
  for (const chunk of generateCsvChunks(rows)) {
    hash.update(chunk.csv);
    count += chunk.rows;
    const split = chunk.csv.split("\n");
    expect(split).toHaveLength(chunk.rows);
    lines.push(...split);
  }
  return { digest: hash.digest("hex"), count, lines };
}

describe("generateCsvChunks", () => {
  const first = collect(100_000);

  it("요청한 행 수를 정확히 만든다", () => {
    expect(first.count).toBe(100_000);
  });

  it("같은 시드면 항상 같은 데이터를 만든다", () => {
    expect(collect(100_000).digest).toBe(first.digest);
  });

  it("모든 행이 컬럼 수만큼 필드를 가진다", () => {
    for (const line of first.lines.slice(0, 5_000)) {
      expect(line.split(",")).toHaveLength(COLUMNS.length);
    }
  });

  it("기획한 범주 개수를 만든다", () => {
    const distinct = (i: number) =>
      new Set(first.lines.map((l) => l.split(",")[i])).size;
    expect(distinct(1)).toBe(3); // factory
    expect(distinct(2)).toBe(4); // line
    expect(distinct(3)).toBe(120); // machine
    expect(distinct(4)).toBe(4); // sensor_type
    expect(distinct(5)).toBe(3); // shift
    // lot_id: 10만 행은 측정 간격(약 3.4h)이 LOT 길이(1~2.5h)보다 길어
    // 시각마다 라인당 LOT 하나씩만 잡힌다. 100만 행이면 약 5,000개가 된다.
    expect(distinct(6)).toBeGreaterThan(2_000);
    expect(distinct(7)).toBe(3); // status
  });

  it("이상 구간과 측정 누락이 섞여 있다", () => {
    const statuses = first.lines.map((l) => l.split(",")[7]);
    const missing = first.lines.filter((l) => l.split(",")[8] === "").length;
    const anomalyRatio =
      statuses.filter((s) => s === "이상").length / first.count;
    expect(missing).toBeGreaterThan(0);
    expect(anomalyRatio).toBeGreaterThan(0.001);
    expect(anomalyRatio).toBeLessThan(0.1);
  });

  it("한 시각에 모든 센서가 한 번씩 측정된다", () => {
    const firstTs = first.lines[0].split(",")[0];
    const sameTs = first.lines.filter((l) => l.startsWith(firstTs)).length;
    expect(sameTs).toBe(SENSOR_COUNT);
  });
});

describe("shiftOf", () => {
  it("KST 시각으로 근무조를 나눈다", () => {
    const h = 3_600_000;
    expect(shiftOf(0)).toBe("심야");
    expect(shiftOf(6 * h)).toBe("주간");
    expect(shiftOf(14 * h)).toBe("야간");
    expect(shiftOf(22 * h)).toBe("심야");
  });
});
