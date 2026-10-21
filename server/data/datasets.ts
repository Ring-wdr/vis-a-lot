// DB Worker 안에서 도는 데이터셋 관리자. 샘플(생성기) 데이터셋과 업로드한 CSV 데이터셋의 테이블 생성,
// COPY 적재, 컬럼 통계를 맡는다. 데이터셋은 id로 구분하고, 테이블 이름은 메타에 적어 둔다.

import type { PGlite } from "@electric-sql/pglite";
import { del, get, set } from "idb-keyval";
import type { DatasetStatus, UploadInfo } from "../api/types";
import {
  type CsvFile,
  type CsvOptions,
  extractCsvFiles,
  type InspectedCsv,
  inspectCsv,
} from "./csv-import";
import {
  type ColumnSchema,
  columnOf,
  type DatasetSchema,
  ident,
  type LogicalType,
  readTableSchema,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import { generateCsvChunks } from "./generator";
import {
  createReadingsSql,
  GENERATOR_VERSION,
  readingsTable,
  SAMPLES,
  sampleIdOf,
  sampleOf,
} from "./schema";

/** 적재가 끝난 뒤 센 컬럼별 고유값 수 */
type ColumnStat = { name: string; distinct: number };

/** 스키마 + 고유값 수. 고유값은 적재가 끝나야 알 수 있어 그 전에는 null이다. */
export type ColumnInfo = ColumnSchema & { distinct: number | null };

type MetaRow = {
  id: string;
  kind: "sample" | "upload";
  name: string;
  tbl: string;
  status: "generating" | "ready" | "failed";
  columns: ColumnStat[] | null;
  row_count: number | null;
  generate_ms: number | null;
  upload: StoredUpload | null;
  error: string | null;
};

/** 메타에 남기는 업로드 정보 (원본 파일은 IndexedDB에 따로 둔다) */
type StoredUpload = Omit<UploadInfo, "createdAt"> & { createdAt: number };

/** 업로드 결과. 거절은 사용자에게 그대로 보여줄 사유와 함께 돌려준다. */
export type UploadResult =
  | { ok: true; status: DatasetStatus }
  | { ok: false; error: string };

type Chunks = Iterable<{ csv: string; rows: number }>;

const rawKey = (id: string) => `upload:${id}`;

const SQL_TYPES: Record<LogicalType, string> = {
  numeric: "double precision",
  datetime: "timestamptz",
  categorical: "text",
};

export class DatasetManager {
  readonly #db: PGlite;
  /** 적재 중인 데이터셋의 진행 상태. DB를 거치지 않고 바로 응답하기 위해 메모리에 둔다. */
  readonly #progress = new Map<string, DatasetStatus>();
  /** 테이블 스키마. 테이블을 다시 만들 때만 바뀌므로 만들 때 지운다. */
  readonly #schemas = new Map<string, DatasetSchema>();
  #queue: Promise<void> = Promise.resolve();

  private constructor(db: PGlite) {
    this.#db = db;
  }

  static async open(db: PGlite) {
    await db.exec(`
      create table if not exists dataset_meta (
        id text primary key,
        kind text not null,
        name text not null,
        tbl text not null,
        status text not null,
        generator_version int,
        columns jsonb,
        row_count int,
        generate_ms int,
        upload jsonb,
        error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
    await migrateRowsMeta(db);
    // 적재 도중 새로고침된 데이터셋은 다시 만들 수 없으니 버린다. 샘플은 생성기 버전이 바뀌어도 버린다.
    // 업로드는 원본이 남아 있으므로 실패로 남겨 두고 '수정'으로 다시 적재할 수 있게 한다.
    const stale = await db.query<Pick<MetaRow, "id" | "kind" | "tbl">>(
      `select id, kind, tbl from dataset_meta
       where status = 'generating' or (kind = 'sample' and generator_version <> $1)`,
      [GENERATOR_VERSION],
    );
    for (const { id, kind, tbl } of stale.rows) {
      await db.exec(`drop table if exists ${tbl}`);
      if (kind === "sample") {
        await db.query("delete from dataset_meta where id = $1", [id]);
      } else {
        await db.query(
          "update dataset_meta set status = 'failed', error = $2 where id = $1",
          [id, "적재 도중 중단되었습니다. 수정으로 다시 적재하세요."],
        );
      }
    }
    return new DatasetManager(db);
  }

  /** 샘플(등록 여부와 상관없이 모두) + 업로드한 데이터셋(최근 순) */
  async statuses(): Promise<DatasetStatus[]> {
    const meta = await this.#meta();
    const samples = SAMPLES.map((s) => this.#statusOf(s.id, meta.get(s.id)));
    const uploads = [...meta.values()]
      .filter((m) => m.kind === "upload")
      .sort((a, b) => (b.upload?.createdAt ?? 0) - (a.upload?.createdAt ?? 0))
      .map((m) => this.#statusOf(m.id, m));
    return [...samples, ...uploads];
  }

  /** 모르는 id면 null */
  async status(id: string): Promise<DatasetStatus | null> {
    const meta = await this.#metaOf(id);
    if (!meta && !sampleOf(id) && !this.#progress.has(id)) return null;
    return this.#statusOf(id, meta);
  }

  /** 샘플이 없으면 생성을 시작하고 바로 현재 상태를 돌려준다. */
  async ensure(id: string): Promise<DatasetStatus | null> {
    const sample = sampleOf(id);
    const current = await this.status(id);
    if (!sample || !current || current.state !== "missing") return current;

    const queued = this.#queued(id, "sample", sample.name, sample.rows);
    const table = readingsTable(sample.rows);
    this.#enqueue(id, async () => {
      await this.#db.query(
        `insert into dataset_meta (id, kind, name, tbl, status, generator_version)
         values ($1, 'sample', $2, $3, 'generating', $4)
         on conflict (id) do update set status = 'generating', generator_version = $4, updated_at = now()`,
        [id, sample.name, table, GENERATOR_VERSION],
      );
      await this.#fill(
        id,
        table,
        createReadingsSql(sample.rows),
        generateCsvChunks(sample.rows),
      );
    });
    return queued;
  }

  /** CSV 또는 zip을 검사해 받아들이면 적재를 시작한다. 스키마가 맞지 않으면 아무것도 남기지 않고 거절한다. */
  async upload(input: {
    name: string;
    file: CsvFile;
    options: CsvOptions;
  }): Promise<UploadResult> {
    const id = `up-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const files = await extractCsvFiles(input.file);
    const inspected = await inspectCsv(files, input.options);
    const upload: StoredUpload = {
      fileName: input.file.name,
      size: input.file.bytes.byteLength,
      files: files.map((f) => ({ name: f.name, size: f.bytes.byteLength })),
      createdAt: Date.now(),
      options: input.options,
      inferred: inspected.inferred,
    };
    await set(
      rawKey(id),
      files.map((f) => ({ name: f.name, blob: new Blob([f.bytes.slice()]) })),
    );
    await this.#db.query(
      `insert into dataset_meta (id, kind, name, tbl, status, upload)
       values ($1, 'upload', $2, $3, 'generating', $4)`,
      [id, input.name, uploadTable(id), JSON.stringify(upload)],
    );
    return { ok: true, status: this.#import(id, input.name, inspected) };
  }

  /**
   * 업로드한 데이터셋의 이름이나 전처리 옵션을 바꾼다. 옵션이 바뀌면 원본으로 다시 검사해,
   * 받아들일 수 있을 때만 테이블을 다시 만든다 (거절되면 기존 데이터를 그대로 둔다).
   */
  async edit(
    id: string,
    patch: { name?: string; options?: CsvOptions },
  ): Promise<UploadResult | null> {
    const meta = await this.#metaOf(id);
    if (!meta || meta.kind !== "upload" || !meta.upload) return null;
    if (this.#progress.has(id)) {
      return { ok: false, error: "적재 중에는 수정할 수 없습니다." };
    }
    const name = patch.name ?? meta.name;
    if (!patch.options) {
      await this.#db.query(
        "update dataset_meta set name = $2, updated_at = now() where id = $1",
        [id, name],
      );
      return { ok: true, status: this.#statusOf(id, { ...meta, name }) };
    }
    const stored = await get<{ name: string; blob: Blob }[]>(rawKey(id));
    if (!stored) {
      return { ok: false, error: "원본 파일이 없어 다시 적재할 수 없습니다." };
    }
    const files = await Promise.all(
      stored.map(async (f) => ({
        name: f.name,
        bytes: new Uint8Array(await f.blob.arrayBuffer()),
      })),
    );
    const inspected = await inspectCsv(files, patch.options);
    const upload: StoredUpload = {
      ...meta.upload,
      options: patch.options,
      inferred: inspected.inferred,
    };
    await this.#db.query(
      `update dataset_meta set name = $2, upload = $3, status = 'generating', error = null,
         columns = null, updated_at = now() where id = $1`,
      [id, name, JSON.stringify(upload)],
    );
    return { ok: true, status: this.#import(id, name, inspected) };
  }

  /** 업로드한 데이터셋을 지운다. 적재 중이면 지우지 않는다. */
  async remove(id: string): Promise<"removed" | "busy" | "missing"> {
    const meta = await this.#metaOf(id);
    if (!meta || meta.kind !== "upload") return "missing";
    if (this.#progress.has(id)) return "busy";
    await this.#db.exec(`drop table if exists ${meta.tbl}`);
    await this.#db.query("delete from dataset_meta where id = $1", [id]);
    await del(rawKey(id));
    this.#schemas.delete(id);
    return "removed";
  }

  /**
   * 데이터셋 스키마. 적재를 시작하면 테이블이 먼저 만들어지므로 적재 중에도 알 수 있고,
   * 등록하지 않은 데이터셋이면 null이다.
   */
  async schema(id: string): Promise<DatasetSchema | null> {
    const cached = this.#schemas.get(id);
    if (cached) return cached;
    const meta = await this.#metaOf(id);
    if (!meta || meta.status === "failed") return null;
    const schema = await readTableSchema(this.#db, meta.tbl);
    if (schema) this.#schemas.set(id, schema);
    return schema;
  }

  /** 조회에 쓸 테이블 이름. 모르는 데이터셋이면 null */
  async table(id: string) {
    return (await this.#metaOf(id))?.tbl ?? null;
  }

  /** 스키마와 고유값 수 (고유값은 준비가 끝난 뒤에만) */
  async columnInfo(id: string): Promise<ColumnInfo[] | null> {
    const schema = await this.schema(id);
    if (!schema) return null;
    const stats = await this.#stats(id);
    const distinct = new Map(stats?.map((s) => [s.name, s.distinct]));
    return schema.columns.map((c) => ({
      ...c,
      distinct: distinct.get(c.name) ?? null,
    }));
  }

  /** 준비가 끝난 데이터셋의 컬럼별 고유값 수. 아직이면 null */
  async #stats(id: string) {
    const res = await this.#db.query<Pick<MetaRow, "columns">>(
      "select columns from dataset_meta where id = $1 and status = 'ready'",
      [id],
    );
    return res.rows[0]?.columns ?? null;
  }

  /** 준비가 끝났는지 (조회·집계를 받을 수 있는지) */
  async ready(id: string) {
    return (await this.#stats(id)) !== null;
  }

  /**
   * split 조합 개수. 컬럼별 고유값의 곱이 상한이므로, 곱이 limit 이하면 쿼리 없이 그 값을 쓰고
   * 넘을 때만 실제 조합 수를 센다.
   */
  async splitCount(
    id: string,
    cols: string[],
    limit: number,
    filters?: ChartFilter[],
  ) {
    if (cols.length === 0) return { count: 1, exact: true };
    const schema = await this.schema(id);
    const stats = await this.#stats(id);
    const table = await this.table(id);
    if (!schema || !stats || !table) throw new Error("dataset is not ready");
    const names = cols.map((c) => ident(columnOf(schema, c).name)).join(", ");
    // 필터가 있으면 고유값 곱으로 어림할 수 없으니 실제로 센다.
    if (filters && filters.length > 0) {
      const filter = filterSql(schema, filters);
      const res = await this.#db.query<{ count: number }>(
        `select count(*)::int as count from (select distinct ${names} from ${table} where true${filter.sql}) s`,
        filter.params,
      );
      return { count: res.rows[0].count, exact: true };
    }
    const distinct = new Map(stats.map((c) => [c.name, c.distinct]));
    const upper = cols.reduce(
      (acc, c) => acc * (distinct.get(c) ?? Infinity),
      1,
    );
    if (cols.length === 1) return { count: upper, exact: true };
    if (upper <= limit) return { count: upper, exact: false };
    const res = await this.#db.query<{ count: number }>(
      `select count(*)::int as count from (select distinct ${names} from ${table}) s`,
    );
    return { count: res.rows[0].count, exact: true };
  }

  #queued(
    id: string,
    kind: DatasetStatus["kind"],
    name: string,
    total: number,
  ): DatasetStatus {
    const queued: DatasetStatus = {
      id,
      kind,
      name,
      state: "generating",
      phase: "copy",
      done: 0,
      total,
    };
    this.#progress.set(id, queued);
    return queued;
  }

  /** 적재는 한 번에 하나씩 순서대로 한다. 실패하면 샘플은 지우고, 업로드는 사유와 함께 실패로 남긴다. */
  #enqueue(id: string, work: () => Promise<void>) {
    this.#queue = this.#queue.then(() =>
      work().catch(async (err) => {
        console.error(`dataset ${id} load failed`, err);
        this.#progress.delete(id);
        const message = err instanceof Error ? err.message : String(err);
        await this.#db
          .query(
            `update dataset_meta set status = 'failed', error = $2 where id = $1 and kind = 'upload'`,
            [id, `적재 실패: ${message}`],
          )
          .catch(() => undefined);
        await this.#db
          .query("delete from dataset_meta where id = $1 and kind = 'sample'", [
            id,
          ])
          .catch(() => undefined);
      }),
    );
  }

  #import(id: string, name: string, inspected: InspectedCsv) {
    const queued = this.#queued(id, "upload", name, inspected.rows);
    const table = uploadTable(id);
    const cols = inspected.columns
      .map((c) => `${ident(c.name)} ${SQL_TYPES[c.type]}`)
      .join(",\n  ");
    this.#enqueue(id, () =>
      this.#fill(
        id,
        table,
        `create table ${table} (\n  ${cols}\n)`,
        inspected.chunks,
      ),
    );
    return { ...queued };
  }

  async #fill(id: string, table: string, createSql: string, chunks: Chunks) {
    const started = performance.now();
    const progress = this.#progress.get(id) as DatasetStatus;

    this.#schemas.delete(id);
    await this.#db.exec(`drop table if exists ${table}; ${createSql};`);

    for (const chunk of chunks) {
      await this.#db.query(
        `copy ${table} from '/dev/blob' with (format csv)`,
        [],
        { blob: new Blob([chunk.csv]) },
      );
      progress.done += chunk.rows;
    }

    progress.phase = "analyze";
    const columns = await this.#analyze(table);
    const generateMs = Math.round(performance.now() - started);
    await this.#db.query(
      `update dataset_meta set status = 'ready', columns = $2, row_count = $3, generate_ms = $4,
         error = null, updated_at = now()
       where id = $1`,
      [id, JSON.stringify(columns), progress.done, generateMs],
    );
    this.#progress.delete(id);
  }

  /**
   * 컬럼별 고유값 개수. split by의 30,000개 제한을 미리 판단하고, legend로 쓸 수 있는지
   * (범주이고 8개 이하) 정하는 데 쓴다. 컬럼은 테이블 스키마에서 읽는다.
   */
  async #analyze(table: string): Promise<ColumnStat[]> {
    const schema = await readTableSchema(this.#db, table);
    if (!schema) throw new Error(`table ${table} not found`);
    // 결과 키는 순서대로 c0, c1 …로 받는다 (이름에 무엇이 들어 있어도 된다).
    const select = schema.columns
      .map((c, i) => `count(distinct ${ident(c.name)})::int as c${i}`)
      .join(", ");
    const res = await this.#db.query<Record<string, number>>(
      `select ${select} from ${table}`,
    );
    const counts = res.rows[0];
    return schema.columns.map((c, i) => ({
      name: c.name,
      distinct: counts[`c${i}`],
    }));
  }

  async #meta() {
    const res = await this.#db.query<MetaRow>(
      "select id, kind, name, tbl, status, columns, row_count, generate_ms, upload, error from dataset_meta",
    );
    return new Map(res.rows.map((r) => [r.id, r]));
  }

  async #metaOf(id: string): Promise<MetaRow | undefined> {
    const res = await this.#db.query<MetaRow>(
      "select id, kind, name, tbl, status, columns, row_count, generate_ms, upload, error from dataset_meta where id = $1",
      [id],
    );
    return res.rows[0];
  }

  #statusOf(id: string, meta: MetaRow | undefined): DatasetStatus {
    const progress = this.#progress.get(id);
    const upload = meta?.upload ?? undefined;
    if (progress) return { ...progress, upload };
    const sample = sampleOf(id);
    const kind = meta?.kind ?? "sample";
    const name = meta?.name ?? sample?.name ?? id;
    if (meta?.status === "ready") {
      const rows = meta.row_count ?? 0;
      return {
        id,
        kind,
        name,
        state: "ready",
        done: rows,
        total: rows,
        generateMs: meta.generate_ms ?? undefined,
        upload,
      };
    }
    if (meta?.status === "failed") {
      return {
        id,
        kind,
        name,
        state: "failed",
        done: 0,
        total: 0,
        error: meta.error ?? undefined,
        upload,
      };
    }
    return {
      id,
      kind,
      name,
      state: "missing",
      done: 0,
      total: sample?.rows ?? 0,
    };
  }
}

function uploadTable(id: string) {
  return `upload_${id.replace(/[^a-z0-9]/g, "")}`;
}

/** 행 수로 구분하던 예전 메타(datasets 테이블)를 id 기반 메타로 옮긴다. 테이블은 그대로 쓴다. */
async function migrateRowsMeta(db: PGlite) {
  const old = await db.query<{ exists: boolean }>(
    "select to_regclass('datasets') is not null as exists",
  );
  if (!old.rows[0].exists) return;
  const rows = await db.query<{
    rows: number;
    generator_version: number;
    status: string;
    columns: ColumnStat[] | null;
    generate_ms: number | null;
  }>(
    "select rows, generator_version, status, columns, generate_ms from datasets where status = 'ready'",
  );
  for (const r of rows.rows) {
    const id = sampleIdOf(r.rows);
    const sample = id && sampleOf(id);
    if (!sample) continue;
    await db.query(
      `insert into dataset_meta (id, kind, name, tbl, status, generator_version, columns, row_count, generate_ms)
       values ($1, 'sample', $2, $3, 'ready', $4, $5, $6, $7) on conflict (id) do nothing`,
      [
        id,
        sample.name,
        readingsTable(sample.rows),
        r.generator_version,
        JSON.stringify(r.columns),
        r.rows,
        r.generate_ms,
      ],
    );
  }
  await db.exec("drop table datasets");
}
