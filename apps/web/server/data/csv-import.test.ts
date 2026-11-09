import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  CsvRejectError,
  columnNames,
  DEFAULT_CSV_OPTIONS,
  decodeCsv,
  extractCsvFiles,
  inspectCsv,
  isDatetimeText,
  previewCsv,
  tableColumnsOf,
} from "./csv-import";

const enc = new TextEncoder();
const csv = (name: string, text: string) => ({ name, bytes: enc.encode(text) });
const OPTIONS = DEFAULT_CSV_OPTIONS;

describe("inspectCsv", () => {
  it("값으로 타입을 추론하고 null 값은 빈 필드로 넘긴다", async () => {
    const result = await inspectCsv(
      [
        csv(
          "a.csv",
          "ts,machine,value\n2023-07-28 13:18:26,M1,1.5\n2023-07-29,M2,NA\n",
        ),
      ],
      { ...OPTIONS, nullValue: "NA" },
    );
    expect(tableColumnsOf(result)).toEqual([
      { name: "ts", type: "datetime" },
      { name: "machine", type: "categorical" },
      { name: "value", type: "numeric" },
    ]);
    expect(result.rows).toBe(2);
    expect(result.chunks[0].csv).toBe(
      '"2023-07-28 13:18:26","M1","1.5"\n"2023-07-29","M2",',
    );
  });

  it("구분 기호와 헤더 없음을 처리한다", async () => {
    const result = await inspectCsv([csv("a.tsv", "a\t1\nb\t2")], {
      ...OPTIONS,
      delimiter: "\t",
      header: false,
    });
    expect(result.columns.map((c) => c.name)).toEqual(["column_1", "column_2"]);
    expect(result.columns[1].type).toBe("numeric");
  });

  it("여러 파일은 스키마가 같으면 합친다", async () => {
    const result = await inspectCsv(
      [csv("1.csv", "k,v\na,1\n"), csv("2.csv", "k,v\nb,\nc,3\n")],
      OPTIONS,
    );
    expect(result.rows).toBe(3);
    expect(result.columns[1].type).toBe("numeric");
  });

  it("컬럼 이름이 다르면 거절한다", async () => {
    await expect(
      inspectCsv([csv("1.csv", "k,v\na,1"), csv("2.csv", "k,w\nb,2")], OPTIONS),
    ).rejects.toThrow(/스키마가 다릅니다.*'v'.*'w'/);
  });

  it("컬럼 수가 다르면 거절한다", async () => {
    await expect(
      inspectCsv([csv("1.csv", "k,v\na,1"), csv("2.csv", "k\nb")], OPTIONS),
    ).rejects.toBeInstanceOf(CsvRejectError);
  });

  it("파일마다 추론한 타입이 다르면 거절한다", async () => {
    await expect(
      inspectCsv(
        [csv("1.csv", "k,v\na,1"), csv("2.csv", "k,v\nb,N/A")],
        OPTIONS,
      ),
    ).rejects.toThrow(/'v' 컬럼이 1.csv에서는 숫자, 2.csv에서는 범주/);
  });

  it("직접 정한 타입은 모든 값이 맞아야 한다", async () => {
    const files = [csv("1.csv", "k,v\na,1\nb,x")];
    await expect(
      inspectCsv(files, { ...OPTIONS, types: { v: "numeric" } }),
    ).rejects.toThrow(/1.csv 3행의 값 'x'/);
    const forced = await inspectCsv([csv("1.csv", "k,v\n1,1")], {
      ...OPTIONS,
      types: { k: "categorical" },
    });
    expect(forced.columns[0].type).toBe("categorical");
    expect(forced.columns[0].inferred).toBe("numeric");
  });

  it("필드 수가 맞지 않는 행은 거절한다", async () => {
    await expect(
      inspectCsv([csv("1.csv", "a,b\n1,2,3")], OPTIONS),
    ).rejects.toThrow(/1.csv 2행/);
  });

  it("데이터 오류 무시면 깨진 행은 건너뛰고 바꿀 수 없는 값은 null로 넣는다", async () => {
    const result = await inspectCsv([csv("1.csv", "k,v\na,1\nb,x\nc,2,9")], {
      ...OPTIONS,
      ignoreErrors: true,
      types: { v: "numeric" },
    });
    expect(result.rows).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.columns[1]).toMatchObject({ type: "numeric", invalid: 1 });
    expect(result.chunks[0].csv).toBe('"a","1"\n"b",');
  });

  it("뺀 컬럼은 적재하지 않는다", async () => {
    const result = await inspectCsv([csv("1.csv", "k,v,w\na,1,x")], {
      ...OPTIONS,
      excluded: ["v"],
    });
    expect(tableColumnsOf(result).map((c) => c.name)).toEqual(["k", "w"]);
    expect(result.chunks[0].csv).toBe('"a","x"');
    await expect(
      inspectCsv([csv("1.csv", "k\na")], { ...OPTIONS, excluded: ["k"] }),
    ).rejects.toThrow(/하나 이상/);
  });

  it("날짜 시간 형식으로 시계열을 읽어 ISO로 바꾼다", async () => {
    const result = await inspectCsv(
      [csv("1.csv", "ts,v\n28/07/2023 13:18,1\n01/08/2023 09:05,2")],
      { ...OPTIONS, datetimeFormat: "dd/MM/yyyy HH:mm" },
    );
    expect(result.columns[0].type).toBe("datetime");
    expect(result.chunks[0].csv).toBe(
      '"2023-07-28 13:18:00.000","1"\n"2023-08-01 09:05:00.000","2"',
    );
  });

  it("따옴표 문자를 바꿀 수 있다", async () => {
    const result = await inspectCsv([csv("1.csv", "k;v\n'a;b';1")], {
      ...OPTIONS,
      delimiter: ";",
      quote: "'",
    });
    expect(result.chunks[0].csv).toBe('"a;b","1"');
  });

  it("진행률을 두 번 읽는 글자 수로 알린다", async () => {
    const seen: [number, number][] = [];
    await inspectCsv([csv("1.csv", "k\na\nb")], OPTIONS, (d, t) =>
      seen.push([d, t]),
    );
    expect(seen.at(-1)).toEqual([10, 10]);
  });

  it("중간에 양보했다 이어 읽어도 진행률이 줄지 않고 끝까지 오른다", async () => {
    const text = `k\n${Array.from({ length: 50_000 }, (_, i) => i).join("\n")}`;
    const seen: number[] = [];
    await inspectCsv([csv("1.csv", text)], OPTIONS, (d, t) => seen.push(d / t));
    expect(seen.length).toBeGreaterThan(2);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    // 첫 번째 읽기(추론) 중간에도 0보다 큰 진행률을 알린다.
    expect(seen[1]).toBeGreaterThan(0.1);
  });
});

describe("previewCsv", () => {
  it("원본 줄과 정한 타입으로 바꾼 행, 바꿀 수 없는 칸을 돌려준다", async () => {
    const preview = await previewCsv(csv("1.csv", "k,v\na,1\nb,x"), {
      ...OPTIONS,
      types: { v: "numeric" },
    });
    expect(preview.raw).toEqual(["k,v", "a,1", "b,x"]);
    expect(preview.columns[1]).toEqual({
      name: "v",
      inferred: "categorical",
      type: "numeric",
    });
    expect(preview.rows).toEqual([
      ["a", "1"],
      ["b", "x"],
    ]);
    expect(preview.invalid).toEqual([[1, 1]]);
  });

  it("파싱이 실패해도 원본 줄과 사유를 돌려준다", async () => {
    const preview = await previewCsv(csv("1.csv", "a,b\n1,2,3"), OPTIONS);
    expect(preview.raw).toEqual(["a,b", "1,2,3"]);
    expect(preview.error).toMatch(/2행/);
  });
});

describe("extractCsvFiles", () => {
  it("zip 안의 CSV만 이름순으로 꺼낸다", async () => {
    const bytes = zipSync({
      "b.csv": enc.encode("x\n1"),
      "dir/a.csv": enc.encode("x\n2"),
      "README.md": enc.encode("hi"),
      "__MACOSX/._b.csv": enc.encode("junk"),
    });
    const files = await extractCsvFiles({ name: "data.zip", bytes });
    expect(files.map((f) => f.name)).toEqual(["b.csv", "dir/a.csv"]);
  });

  it("CSV가 없는 zip은 거절한다", async () => {
    const bytes = zipSync({ "a.txt": enc.encode("x") });
    await expect(
      extractCsvFiles({ name: "data.zip", bytes }),
    ).rejects.toBeInstanceOf(CsvRejectError);
  });
});

describe("helpers", () => {
  it("BOM을 떼고 EUC-KR도 읽는다", () => {
    expect(decodeCsv(enc.encode("﻿a,b"))).toBe("a,b");
    // '가' = 0xB0 0xA1 (EUC-KR)
    expect(decodeCsv(new Uint8Array([0xb0, 0xa1]))).toBe("가");
  });

  it("인코딩을 정하면 그대로 읽는다", () => {
    expect(decodeCsv(new Uint8Array([0xb0, 0xa1]), "euc-kr")).toBe("가");
  });

  it("헤더 이름을 정리한다", () => {
    expect(columnNames([" a ", "", "a"], 3)).toEqual(["a", "column_2", "a_2"]);
  });

  it("Postgres가 읽는 ISO 시각만 시각으로 본다", () => {
    expect(isDatetimeText("2023-07-28T13:18:26Z")).toBe(true);
    expect(isDatetimeText("2023-13-45")).toBe(false);
    expect(isDatetimeText("07/28/2023")).toBe(false);
  });
});
