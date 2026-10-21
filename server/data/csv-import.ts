// 업로드한 CSV(또는 CSV를 묶은 zip)의 전처리: 파일 꺼내기 → 문자열로 읽기 → 파싱하며 검사·타입 추론 →
// COPY에 넣을 정규화된 CSV 조각. 파서는 papaparse 하나만 쓴다. 구분 기호·따옴표·빈 줄·BOM·인코딩을
// 여기서 모두 처리하고, Postgres에는 정해진 모양(쉼표, 값마다 따옴표, null은 빈 필드)으로만 넘긴다.
// zip·CSV 라이브러리는 업로드가 들어올 때만 불러온다.

import type { LogicalType } from "./dataset-schema";

export type CsvOptions = {
  /** 한 글자 구분 기호 */
  delimiter: string;
  /** 첫 번째 행이 헤더인지. 아니면 컬럼 이름을 column_1, column_2 …로 붙인다. */
  header: boolean;
  /** 이 값과 같은 필드는 null로 적재한다. 기본은 빈 문자열 */
  nullValue: string;
  /** 컬럼별로 직접 정한 타입. 없는 컬럼은 값으로 추론한다. */
  types?: Record<string, LogicalType>;
};

export type CsvFile = { name: string; bytes: Uint8Array };

/** 사용자에게 그대로 보여줄 거절 사유 */
export class CsvRejectError extends Error {}

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_COLUMNS = 200;
const MAX_FILES = 500;
/** Postgres 식별자 길이 (바이트) */
const MAX_IDENT_BYTES = 63;
const CHUNK_ROWS = 25_000;

const isZip = (bytes: Uint8Array) =>
  bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03;

/**
 * 올린 파일에서 CSV를 꺼낸다. zip이면 안의 .csv를 모두(폴더 포함, 이름순), 아니면 파일 그대로.
 * zip 안의 CSV가 아닌 파일과 macOS 메타 파일은 건너뛴다.
 */
export async function extractCsvFiles(file: CsvFile): Promise<CsvFile[]> {
  if (!isZip(file.bytes)) {
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
      throw new CsvRejectError("CSV 또는 zip 파일만 올릴 수 있습니다.");
    }
    return [file];
  }
  const { unzipSync } = await import("fflate");
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(file.bytes, {
      filter: (f) =>
        /\.csv$/i.test(f.name) &&
        !f.name.startsWith("__MACOSX/") &&
        !/(^|\/)\./.test(f.name),
    });
  } catch {
    throw new CsvRejectError("zip 파일을 열 수 없습니다.");
  }
  const files = Object.entries(entries)
    .map(([name, bytes]) => ({ name, bytes }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (files.length === 0) {
    throw new CsvRejectError("zip 안에 CSV 파일이 없습니다.");
  }
  if (files.length > MAX_FILES) {
    throw new CsvRejectError(
      `zip 안의 CSV가 ${files.length}개입니다. 최대 ${MAX_FILES}개까지 올릴 수 있습니다.`,
    );
  }
  const total = files.reduce((n, f) => n + f.bytes.byteLength, 0);
  if (total > MAX_UPLOAD_BYTES) {
    throw new CsvRejectError(
      `압축을 푼 크기가 ${Math.round(total / 1024 / 1024)}MB로 최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB를 넘습니다.`,
    );
  }
  return files;
}

/** UTF-8로 읽고, 잘못된 바이트가 있으면 국내 엑셀 기본값인 EUC-KR(CP949)로 다시 읽는다. BOM은 뗀다. */
export function decodeCsv(bytes: Uint8Array) {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("euc-kr").decode(bytes);
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

const NUMERIC_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
/** Postgres timestamptz가 그대로 읽는 ISO 형식만 시각으로 본다. */
const DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

export function isNumericText(value: string) {
  return NUMERIC_RE.test(value.trim());
}

export function isDatetimeText(value: string) {
  const v = value.trim();
  return DATETIME_RE.test(v) && !Number.isNaN(Date.parse(v.replace(" ", "T")));
}

/** 처음 어긋난 값. 거절 사유에 보여준다. */
type Sample = { value: string; line: number };

type ColumnStats = {
  nonNull: number;
  notNumeric?: Sample;
  notDatetime?: Sample;
};

/** 값으로 정한 타입. 값이 모두 null이면 정할 수 없다(unknown). */
type InferredType = LogicalType | "unknown";

function inferredOf(stats: ColumnStats): InferredType {
  if (stats.nonNull === 0) return "unknown";
  if (!stats.notNumeric) return "numeric";
  if (!stats.notDatetime) return "datetime";
  return "categorical";
}

const TYPE_LABELS: Record<InferredType, string> = {
  numeric: "숫자",
  datetime: "시계열",
  categorical: "범주",
  unknown: "값 없음",
};

/** 헤더 이름을 컬럼 이름으로: 앞뒤 공백 제거, 빈 이름은 column_n, 63바이트로 자르고, 겹치면 _2, _3 … */
export function columnNames(header: string[] | null, count: number) {
  const encoder = new TextEncoder();
  const clip = (name: string) => {
    let out = name;
    while (encoder.encode(out).byteLength > MAX_IDENT_BYTES)
      out = out.slice(0, -1);
    return out;
  };
  const used = new Set<string>();
  return Array.from({ length: count }, (_, i) => {
    const base = clip(header?.[i]?.trim() || `column_${i + 1}`);
    let name = base;
    for (let n = 2; used.has(name); n++) name = clip(`${base}_${n}`);
    used.add(name);
    return name;
  });
}

type FileResult = {
  name: string;
  columns: string[];
  stats: ColumnStats[];
  rows: number;
  /** COPY에 넣을 CSV 조각 */
  chunks: { csv: string; rows: number }[];
};

const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;

async function parseFile(
  file: CsvFile,
  options: CsvOptions,
): Promise<FileResult> {
  const { default: Papa } = await import("papaparse");
  const text = decodeCsv(file.bytes);
  let columns: string[] | null = null;
  let stats: ColumnStats[] = [];
  const chunks: FileResult["chunks"] = [];
  let lines: string[] = [];
  let rows = 0;
  let line = 0;
  let error: string | undefined;

  Papa.parse<string[]>(text, {
    delimiter: options.delimiter,
    skipEmptyLines: true,
    step: (result, parser) => {
      line++;
      if (result.errors.length > 0) {
        error = `${file.name} ${line}행: ${result.errors[0].message}`;
        parser.abort();
        return;
      }
      const fields = result.data;
      if (columns === null) {
        if (fields.length > MAX_COLUMNS) {
          error = `${file.name}: 컬럼이 ${fields.length}개입니다. 최대 ${MAX_COLUMNS}개까지 올릴 수 있습니다.`;
          parser.abort();
          return;
        }
        columns = columnNames(options.header ? fields : null, fields.length);
        stats = columns.map(() => ({ nonNull: 0 }));
        if (options.header) return;
      }
      if (fields.length !== columns.length) {
        error = `${file.name} ${line}행: 필드가 ${fields.length}개로 컬럼 수(${columns.length}개)와 다릅니다. 구분 기호를 확인하세요.`;
        parser.abort();
        return;
      }
      const out = new Array<string>(fields.length);
      for (let i = 0; i < fields.length; i++) {
        const value = fields[i];
        if (value === options.nullValue) {
          out[i] = "";
          continue;
        }
        const s = stats[i];
        s.nonNull++;
        if (!s.notNumeric && !isNumericText(value))
          s.notNumeric = { value, line };
        if (!s.notDatetime && !isDatetimeText(value))
          s.notDatetime = { value, line };
        out[i] = quote(value);
      }
      lines.push(out.join(","));
      rows++;
      if (lines.length >= CHUNK_ROWS) {
        chunks.push({ csv: lines.join("\n"), rows: lines.length });
        lines = [];
      }
    },
  });
  if (error) throw new CsvRejectError(error);
  if (columns === null)
    throw new CsvRejectError(`${file.name}: 빈 파일입니다.`);
  if (lines.length > 0)
    chunks.push({ csv: lines.join("\n"), rows: lines.length });
  return { name: file.name, columns, stats, rows, chunks };
}

export type InspectedCsv = {
  columns: { name: string; type: LogicalType }[];
  /** 컬럼 순서대로, 값으로 추론한 타입 (직접 정한 타입과 상관없이). 수정 화면의 '자동'에 보여준다. */
  inferred: { name: string; type: LogicalType }[];
  rows: number;
  chunks: { csv: string; rows: number }[];
};

/**
 * 모든 파일을 파싱해 스키마가 하나로 맞는지 본다. 컬럼 수·이름(헤더가 있을 때)·값으로 추론한 타입 중
 * 하나라도 파일마다 다르면 전체를 거절한다. 직접 정한 타입은 모든 값이 그 타입으로 읽혀야 한다.
 */
export async function inspectCsv(
  files: CsvFile[],
  options: CsvOptions,
): Promise<InspectedCsv> {
  if ([...options.delimiter].length !== 1) {
    throw new CsvRejectError("구분 기호는 한 글자여야 합니다.");
  }
  if (options.delimiter === '"' || /[\r\n]/.test(options.delimiter)) {
    throw new CsvRejectError("따옴표와 줄바꿈은 구분 기호로 쓸 수 없습니다.");
  }
  const results: FileResult[] = [];
  for (const file of files) results.push(await parseFile(file, options));

  const [first] = results;
  for (const r of results.slice(1)) {
    if (r.columns.length !== first.columns.length) {
      throw new CsvRejectError(
        `스키마가 다릅니다: ${first.name}은 컬럼 ${first.columns.length}개, ${r.name}은 ${r.columns.length}개입니다.`,
      );
    }
    const differ = r.columns.findIndex((c, i) => c !== first.columns[i]);
    if (differ !== -1) {
      throw new CsvRejectError(
        `스키마가 다릅니다: ${differ + 1}번째 컬럼이 ${first.name}에서는 '${first.columns[differ]}', ${r.name}에서는 '${r.columns[differ]}'입니다.`,
      );
    }
  }

  const columns = first.columns.map((name, i) => {
    const forced = options.types?.[name];
    if (forced && forced !== "categorical") {
      for (const r of results) {
        const bad =
          forced === "numeric" ? r.stats[i].notNumeric : r.stats[i].notDatetime;
        if (bad) {
          throw new CsvRejectError(
            `'${name}'을 ${TYPE_LABELS[forced]}로 정했지만 ${r.name} ${bad.line}행의 값 '${bad.value}'은 ${TYPE_LABELS[forced]}가 아닙니다.`,
          );
        }
      }
    }
    // 파일마다 값으로 추론한 타입이 같아야 한다. 값이 모두 null인 파일은 어느 쪽에도 맞는다.
    let inferred: { type: InferredType; file: FileResult } | undefined;
    for (const r of results) {
      const type = inferredOf(r.stats[i]);
      if (type === "unknown") continue;
      if (!inferred) {
        inferred = { type, file: r };
      } else if (inferred.type !== type && !forced) {
        throw new CsvRejectError(
          `스키마가 다릅니다: '${name}' 컬럼이 ${inferred.file.name}에서는 ${TYPE_LABELS[inferred.type]}, ${r.name}에서는 ${TYPE_LABELS[type]}입니다.`,
        );
      }
    }
    const auto: LogicalType =
      !inferred || inferred.type === "unknown" ? "categorical" : inferred.type;
    return { name, type: forced ?? auto, auto };
  });

  return {
    columns: columns.map(({ name, type }) => ({ name, type })),
    inferred: columns.map((c) => ({ name: c.name, type: c.auto })),
    rows: results.reduce((n, r) => n + r.rows, 0),
    chunks: results.flatMap((r) => r.chunks),
  };
}
