import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  type CsvOptions,
  CsvRejectError,
  columnNames,
  decodeCsv,
  extractCsvFiles,
  inspectCsv,
  isDatetimeText,
} from "./csv-import";

const enc = new TextEncoder();
const csv = (name: string, text: string) => ({ name, bytes: enc.encode(text) });
const OPTIONS: CsvOptions = { delimiter: ",", header: true, nullValue: "" };

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
    expect(result.columns).toEqual([
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
      delimiter: "\t",
      header: false,
      nullValue: "",
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
    expect(forced.inferred[0].type).toBe("numeric");
  });

  it("필드 수가 맞지 않는 행은 거절한다", async () => {
    await expect(
      inspectCsv([csv("1.csv", "a,b\n1,2,3")], OPTIONS),
    ).rejects.toThrow(/1.csv 2행/);
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

  it("헤더 이름을 정리한다", () => {
    expect(columnNames([" a ", "", "a"], 3)).toEqual(["a", "column_2", "a_2"]);
  });

  it("Postgres가 읽는 ISO 시각만 시각으로 본다", () => {
    expect(isDatetimeText("2023-07-28T13:18:26Z")).toBe(true);
    expect(isDatetimeText("2023-13-45")).toBe(false);
    expect(isDatetimeText("07/28/2023")).toBe(false);
  });
});
