// 업로드한 CSV(또는 CSV를 묶은 zip)의 전처리: 파일 꺼내기 → 문자열로 읽기 → 파싱하며 검사·타입 추론 →
// 정한 타입으로 값 변환 → COPY에 넣을 정규화된 CSV 조각. 파서는 papaparse 하나만 쓴다. 구분 기호·따옴표·
// 빈 줄·BOM·인코딩·날짜 형식을 여기서 모두 처리하고, Postgres에는 정해진 모양(쉼표, 값마다 따옴표,
// null은 빈 필드)으로만 넘긴다. zip·CSV 라이브러리는 업로드가 들어올 때만 불러온다.

import type { LogicalType } from "./dataset-schema";
import { compileDatetimeFormat, DatetimeFormatError } from "./datetime-format";

export const CSV_ENCODINGS = ["auto", "utf-8", "euc-kr"] as const;
export type CsvEncoding = (typeof CSV_ENCODINGS)[number];

export type CsvOptions = {
  /** 한 글자 구분 기호 */
  delimiter: string;
  /** 첫 번째 행이 헤더인지. 아니면 컬럼 이름을 column_1, column_2 …로 붙인다. */
  header: boolean;
  /** 이 값과 같은 필드는 null로 적재한다. 기본은 빈 문자열 */
  nullValue: string;
  /** 값을 감싸는 한 글자 따옴표 */
  quote: string;
  /** auto는 UTF-8로 읽고, 잘못된 바이트가 있으면 EUC-KR로 다시 읽는다. */
  encoding: CsvEncoding;
  /** 시계열 값의 형식 (yyyy-MM-dd HH:mm:ss 등). null이면 ISO 형식만 시계열로 본다. */
  datetimeFormat: string | null;
  /** 켜면 정한 타입으로 바꿀 수 없는 값은 null로, 필드 수가 맞지 않는 행은 건너뛴다. 끄면 거절한다. */
  ignoreErrors: boolean;
  /** 컬럼별로 직접 정한 타입. 없는 컬럼은 값으로 추론한다. */
  types?: Record<string, LogicalType>;
  /** 적재하지 않을 컬럼 */
  excluded?: string[];
};

export const DEFAULT_CSV_OPTIONS: CsvOptions = {
  delimiter: ",",
  header: true,
  nullValue: "",
  quote: '"',
  encoding: "auto",
  datetimeFormat: null,
  ignoreErrors: false,
};

/** 예전에 저장한 옵션처럼 빠진 항목은 기본값으로 채운다. */
export function withDefaults(
  options: Partial<CsvOptions> &
    Pick<CsvOptions, "delimiter" | "header" | "nullValue">,
): CsvOptions {
  return { ...DEFAULT_CSV_OPTIONS, ...options };
}

export type CsvFile = { name: string; bytes: Uint8Array };

/** 사용자에게 그대로 보여줄 거절 사유 */
export class CsvRejectError extends Error {}

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_COLUMNS = 200;
const MAX_FILES = 500;
/** Postgres 식별자 길이 (바이트) */
const MAX_IDENT_BYTES = 63;
const CHUNK_ROWS = 25_000;
/** 이만큼 행을 읽을 때마다 다른 요청(진행률 조회 등)이 처리되도록 한 번 양보한다. */
const YIELD_ROWS = 20_000;
/** 미리보기는 파일 앞부분만 읽는다. */
const PREVIEW_BYTES = 1024 * 1024;
const PREVIEW_ROWS = 100;
const PREVIEW_LINES = 50;
const PREVIEW_LINE_CHARS = 2000;

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

/**
 * 바이트를 문자열로 읽고 BOM을 뗀다. auto는 UTF-8로 읽다가 잘못된 바이트가 있으면 국내 엑셀 기본값인
 * EUC-KR(CP949)로 다시 읽는다. partial이면 파일 앞부분만 받은 것이라 끝에서 잘린 글자는 무시한다.
 */
export function decodeCsv(
  bytes: Uint8Array,
  encoding: CsvEncoding = "auto",
  partial = false,
) {
  let text: string;
  if (encoding === "auto") {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes, {
        stream: partial,
      });
    } catch {
      text = new TextDecoder("euc-kr").decode(bytes);
    }
  } else {
    text = new TextDecoder(encoding).decode(bytes);
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

/** 값을 그 타입으로 적재할 문자열로 바꾼다. 바꿀 수 없으면 null */
type Converter = (value: string) => string | null;

function convertersOf(options: CsvOptions): Record<LogicalType, Converter> {
  let datetime: Converter;
  if (options.datetimeFormat) {
    try {
      datetime = compileDatetimeFormat(options.datetimeFormat);
    } catch (err) {
      if (err instanceof DatetimeFormatError)
        throw new CsvRejectError(err.message);
      throw err;
    }
  } else {
    datetime = (v) => (isDatetimeText(v) ? v.trim() : null);
  }
  return {
    numeric: (v) => (isNumericText(v) ? v.trim() : null),
    datetime,
    categorical: (v) => v,
  };
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

const autoOf = (type: InferredType | undefined): LogicalType =>
  !type || type === "unknown" ? "categorical" : type;

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

function checkOptions(options: CsvOptions) {
  if ([...options.delimiter].length !== 1) {
    throw new CsvRejectError("구분 기호는 한 글자여야 합니다.");
  }
  if ([...options.quote].length !== 1) {
    throw new CsvRejectError("따옴표는 한 글자여야 합니다.");
  }
  if (options.quote === options.delimiter) {
    throw new CsvRejectError("따옴표와 구분 기호가 같을 수 없습니다.");
  }
  if (/[\r\n]/.test(options.delimiter + options.quote)) {
    throw new CsvRejectError("줄바꿈은 구분 기호나 따옴표로 쓸 수 없습니다.");
  }
}

type RowHandler = (fields: string[], line: number) => void;

/**
 * 한 파일을 행 단위로 읽는다. 헤더(또는 첫 행)로 컬럼을 정하고, 데이터 행마다 onRow를 부른다.
 * 깨진 행은 ignoreErrors면 건너뛰고(skipped), 아니면 거절한다. 일정 행마다 이벤트 루프에 양보한다.
 */
function parseRows(
  text: string,
  fileName: string,
  options: CsvOptions,
  handlers: {
    onRow: RowHandler;
    onProgress?: (cursor: number) => void;
    /** 이만큼 데이터 행을 읽으면 멈춘다 (미리보기). */
    maxRows?: number;
  },
): Promise<{ columns: string[]; skipped: number; rows: number }> {
  return import("papaparse").then(
    ({ default: Papa }) =>
      new Promise((resolve, reject) => {
        let columns: string[] | null = null;
        let line = 0;
        let rows = 0;
        let skipped = 0;
        /** 앞서 읽은 조각들의 글자 수 */
        let consumed = 0;
        let error: string | undefined;
        const fail = (message: string, parser: { abort(): void }) => {
          error = message;
          parser.abort();
        };

        Papa.parse<string[]>(text, {
          delimiter: options.delimiter,
          quoteChar: options.quote,
          escapeChar: options.quote,
          skipEmptyLines: true,
          step: (result, parser) => {
            line++;
            if (result.errors.length > 0) {
              if (options.ignoreErrors && columns !== null) {
                skipped++;
                return;
              }
              fail(
                `${fileName} ${line}행: ${result.errors[0].message}`,
                parser,
              );
              return;
            }
            const fields = result.data;
            if (columns === null) {
              if (fields.length > MAX_COLUMNS) {
                fail(
                  `${fileName}: 컬럼이 ${fields.length}개입니다. 최대 ${MAX_COLUMNS}개까지 올릴 수 있습니다.`,
                  parser,
                );
                return;
              }
              columns = columnNames(
                options.header ? fields : null,
                fields.length,
              );
              if (options.header) return;
            }
            if (fields.length !== columns.length) {
              if (options.ignoreErrors) {
                skipped++;
                return;
              }
              fail(
                `${fileName} ${line}행: 필드가 ${fields.length}개로 컬럼 수(${columns.length}개)와 다릅니다. 구분 기호와 따옴표를 확인하거나 '데이터 오류 무시'를 켜세요.`,
                parser,
              );
              return;
            }
            handlers.onRow(fields, line);
            rows++;
            if (handlers.maxRows !== undefined && rows >= handlers.maxRows) {
              parser.abort();
              return;
            }
            if (rows % YIELD_ROWS === 0) {
              // 멈췄다 이어 읽으면 나머지를 새 조각으로 읽어 cursor가 0부터 다시 센다.
              consumed += result.meta.cursor;
              handlers.onProgress?.(consumed);
              parser.pause();
              setTimeout(() => parser.resume(), 0);
            }
          },
          complete: () => {
            if (error) reject(new CsvRejectError(error));
            else if (columns === null)
              reject(new CsvRejectError(`${fileName}: 빈 파일입니다.`));
            else resolve({ columns, skipped, rows });
          },
        });
      }),
  );
}

function collectStats(
  stats: ColumnStats[],
  fields: string[],
  line: number,
  options: CsvOptions,
  datetime: Converter,
) {
  for (let i = 0; i < fields.length; i++) {
    const value = fields[i];
    if (value === options.nullValue) continue;
    if (!stats[i]) stats[i] = { nonNull: 0 };
    const s = stats[i];
    s.nonNull++;
    if (!s.notNumeric && !isNumericText(value)) s.notNumeric = { value, line };
    if (!s.notDatetime && datetime(value) === null)
      s.notDatetime = { value, line };
  }
}

const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;

type Scanned = {
  name: string;
  text: string;
  columns: string[];
  stats: ColumnStats[];
};

export type InspectedColumn = {
  name: string;
  type: LogicalType;
  /** 값으로 추론한 타입 (직접 정한 타입과 상관없이) */
  inferred: LogicalType;
  /** 적재하는지 */
  included: boolean;
  /** 정한 타입으로 바꿀 수 없어 null로 넣은 값 수 (데이터 오류 무시일 때만 0이 아닐 수 있다) */
  invalid: number;
};

export type InspectedCsv = {
  /** 파일의 모든 컬럼. 적재하는 것은 included만이다. */
  columns: InspectedColumn[];
  rows: number;
  /** 데이터 오류 무시로 건너뛴 행 수 */
  skipped: number;
  chunks: { csv: string; rows: number }[];
};

/** 적재하는 컬럼만, 테이블을 만들 이름과 타입 */
export const tableColumnsOf = (inspected: InspectedCsv) =>
  inspected.columns
    .filter((c) => c.included)
    .map(({ name, type }) => ({ name, type }));

/**
 * 모든 파일을 파싱해 스키마가 하나로 맞는지 보고, 정한 타입으로 바꾼 COPY용 조각을 만든다.
 * 컬럼 수·이름(헤더가 있을 때)·값으로 추론한 타입 중 하나라도 파일마다 다르면 전체를 거절한다.
 * 직접 정한 타입은 모든 값이 그 타입으로 읽혀야 한다 (데이터 오류 무시면 못 읽는 값은 null).
 * 읽기는 두 번 한다: 추론, 변환. 진행률은 두 번 읽는 글자 수를 합친 것이다.
 */
export async function inspectCsv(
  files: CsvFile[],
  options: CsvOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<InspectedCsv> {
  checkOptions(options);
  const convert = convertersOf(options);
  const texts = files.map((f) => decodeCsv(f.bytes, options.encoding));
  const total = texts.reduce((n, t) => n + t.length, 0) * 2;
  let base = 0;
  const report = (cursor: number) => onProgress?.(base + cursor, total);

  // 1) 추론
  const scanned: Scanned[] = [];
  for (const [k, file] of files.entries()) {
    const stats: ColumnStats[] = [];
    const { columns } = await parseRows(texts[k], file.name, options, {
      onRow: (fields, line) =>
        collectStats(stats, fields, line, options, convert.datetime),
      onProgress: report,
    });
    scanned.push({ name: file.name, text: texts[k], columns, stats });
    base += texts[k].length;
  }

  const [first] = scanned;
  for (const r of scanned.slice(1)) {
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

  const excluded = new Set(options.excluded);
  const columns: InspectedColumn[] = first.columns.map((name, i) => {
    const forced = options.types?.[name];
    const included = !excluded.has(name);
    if (
      included &&
      forced &&
      forced !== "categorical" &&
      !options.ignoreErrors
    ) {
      for (const r of scanned) {
        const s = r.stats[i];
        const bad = forced === "numeric" ? s?.notNumeric : s?.notDatetime;
        if (bad) {
          throw new CsvRejectError(
            `'${name}'을 ${TYPE_LABELS[forced]}로 정했지만 ${r.name} ${bad.line}행의 값 '${bad.value}'은 ${TYPE_LABELS[forced]}가 아닙니다. 타입을 바꾸거나 '데이터 오류 무시'를 켜세요.`,
          );
        }
      }
    }
    // 파일마다 값으로 추론한 타입이 같아야 한다. 값이 모두 null인 파일은 어느 쪽에도 맞는다.
    let inferred: { type: InferredType; file: Scanned } | undefined;
    for (const r of scanned) {
      const type = r.stats[i] ? inferredOf(r.stats[i]) : "unknown";
      if (type === "unknown") continue;
      if (!inferred) {
        inferred = { type, file: r };
      } else if (inferred.type !== type && !forced && included) {
        throw new CsvRejectError(
          `스키마가 다릅니다: '${name}' 컬럼이 ${inferred.file.name}에서는 ${TYPE_LABELS[inferred.type]}, ${r.name}에서는 ${TYPE_LABELS[type]}입니다.`,
        );
      }
    }
    const auto = autoOf(inferred?.type);
    return { name, type: forced ?? auto, inferred: auto, included, invalid: 0 };
  });
  const kept = columns
    .map((c, i) => ({ column: c, index: i, convert: convert[c.type] }))
    .filter((k) => k.column.included);
  if (kept.length === 0) {
    throw new CsvRejectError("적재할 컬럼을 하나 이상 고르세요.");
  }

  // 2) 변환
  const chunks: InspectedCsv["chunks"] = [];
  let lines: string[] = [];
  let rows = 0;
  let skipped = 0;
  for (const r of scanned) {
    const result = await parseRows(r.text, r.name, options, {
      onRow: (fields) => {
        const out = new Array<string>(kept.length);
        for (let j = 0; j < kept.length; j++) {
          const value = fields[kept[j].index];
          if (value === options.nullValue) {
            out[j] = "";
            continue;
          }
          const converted = kept[j].convert(value);
          if (converted === null) {
            kept[j].column.invalid++;
            out[j] = "";
          } else {
            out[j] = quote(converted);
          }
        }
        lines.push(out.join(","));
        if (lines.length >= CHUNK_ROWS) {
          chunks.push({ csv: lines.join("\n"), rows: lines.length });
          lines = [];
        }
      },
      onProgress: report,
    });
    rows += result.rows;
    skipped += result.skipped;
    base += r.text.length;
  }
  if (lines.length > 0)
    chunks.push({ csv: lines.join("\n"), rows: lines.length });
  onProgress?.(total, total);
  return { columns, rows, skipped, chunks };
}

export type CsvPreview = {
  /** 파일 앞부분의 원본 줄 */
  raw: string[];
  columns: {
    name: string;
    /** 미리보기 행으로 추론한 타입 */
    inferred: LogicalType;
    type: LogicalType;
  }[];
  /** 정한 타입으로 바꾼 값. null 값은 null, 바꿀 수 없는 값은 원래 값(invalid에 위치) */
  rows: (string | null)[][];
  /** 바꿀 수 없었던 칸 [행, 열] */
  invalid: [number, number][];
  /** 파싱 중 거절 사유. 원본 줄은 그대로 보여준다. */
  error?: string;
};

/** 파일 앞부분만 읽어 원본 줄, 컬럼, 타입을 바꾼 앞쪽 행을 보여준다. 거절하지 않고 사유를 함께 돌려준다. */
export async function previewCsv(
  file: CsvFile,
  options: CsvOptions,
): Promise<CsvPreview> {
  const partial = file.bytes.byteLength > PREVIEW_BYTES;
  let text = decodeCsv(
    partial ? file.bytes.subarray(0, PREVIEW_BYTES) : file.bytes,
    options.encoding,
    partial,
  );
  // 잘린 마지막 줄은 버린다.
  if (partial) text = text.slice(0, Math.max(0, text.lastIndexOf("\n")));
  const raw = text
    .split(/\r?\n/, PREVIEW_LINES)
    .map((l) =>
      l.length > PREVIEW_LINE_CHARS ? `${l.slice(0, PREVIEW_LINE_CHARS)}…` : l,
    );

  const empty: CsvPreview = { raw, columns: [], rows: [], invalid: [] };
  try {
    checkOptions(options);
    const convert = convertersOf(options);
    const stats: ColumnStats[] = [];
    const sample: { fields: string[] }[] = [];
    const { columns: names } = await parseRows(text, file.name, options, {
      maxRows: PREVIEW_ROWS,
      onRow: (fields, line) => {
        sample.push({ fields });
        collectStats(stats, fields, line, options, convert.datetime);
      },
    });
    const columns = names.map((name, i) => {
      const inferred = autoOf(stats[i] ? inferredOf(stats[i]) : undefined);
      return { name, inferred, type: options.types?.[name] ?? inferred };
    });
    const invalid: [number, number][] = [];
    const rows = sample.map(({ fields }, r) =>
      fields.map((value, c) => {
        if (value === options.nullValue) return null;
        const converted = convert[columns[c].type](value);
        if (converted !== null) return converted;
        invalid.push([r, c]);
        return value;
      }),
    );
    return { raw, columns, rows, invalid };
  } catch (err) {
    if (err instanceof CsvRejectError) return { ...empty, error: err.message };
    throw err;
  }
}
