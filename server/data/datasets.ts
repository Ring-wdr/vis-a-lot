// DB Worker 안에서 도는 데이터셋 관리자. 행 수별 테이블 생성, COPY 적재, 컬럼 통계를 맡는다.

import type { PGlite } from "@electric-sql/pglite";
import type { DatasetStatus } from "../api/types";
import {
  type ColumnSchema,
  columnOf,
  type DatasetSchema,
  ident,
  readTableSchema,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import { generateCsvChunks } from "./generator";
import {
  createReadingsSql,
  GENERATOR_VERSION,
  ROW_SIZES,
  type RowSize,
  readingsTable,
} from "./schema";

/** 적재가 끝난 뒤 센 컬럼별 고유값 수 */
type ColumnStat = { name: string; distinct: number };

/** 스키마 + 고유값 수. 고유값은 적재가 끝나야 알 수 있어 그 전에는 null이다. */
export type ColumnInfo = ColumnSchema & { distinct: number | null };

type MetaRow = {
  rows: RowSize;
  status: "generating" | "ready";
  columns: ColumnStat[] | null;
  generate_ms: number | null;
};

export class DatasetManager {
  readonly #db: PGlite;
  /** 생성 중인 데이터셋의 진행 상태. DB를 거치지 않고 바로 응답하기 위해 메모리에 둔다. */
  readonly #progress = new Map<RowSize, DatasetStatus>();
  /** 테이블 스키마. 테이블을 다시 만들 때만 바뀌므로 만들 때 지운다. */
  readonly #schemas = new Map<RowSize, DatasetSchema>();
  #queue: Promise<void> = Promise.resolve();

  private constructor(db: PGlite) {
    this.#db = db;
  }

  static async open(db: PGlite) {
    await db.exec(`
      create table if not exists datasets (
        rows int primary key,
        generator_version int not null,
        status text not null,
        columns jsonb,
        generate_ms int,
        updated_at timestamptz not null default now()
      );
    `);
    // 생성 도중 새로고침됐거나 생성기 버전이 바뀐 데이터셋은 버리고 다시 만든다.
    const stale = await db.query<{ rows: RowSize }>(
      "select rows from datasets where status <> 'ready' or generator_version <> $1",
      [GENERATOR_VERSION],
    );
    for (const { rows } of stale.rows) {
      await db.exec(`drop table if exists ${readingsTable(rows)}`);
      await db.query("delete from datasets where rows = $1", [rows]);
    }
    return new DatasetManager(db);
  }

  async statuses(): Promise<DatasetStatus[]> {
    const meta = await this.#meta();
    return ROW_SIZES.map((rows) => this.#statusOf(rows, meta.get(rows)));
  }

  async status(rows: RowSize) {
    const meta = await this.#meta();
    return this.#statusOf(rows, meta.get(rows));
  }

  async ensure(rows: RowSize): Promise<DatasetStatus> {
    const current = await this.status(rows);
    if (current.state !== "missing") return current;

    const queued: DatasetStatus = {
      rows,
      state: "generating",
      phase: "copy",
      done: 0,
      total: rows,
    };
    this.#progress.set(rows, queued);
    this.#queue = this.#queue.then(() =>
      this.#generate(rows).catch((err) => {
        console.error(`dataset ${rows} generation failed`, err);
        this.#progress.delete(rows);
      }),
    );
    return queued;
  }

  /**
   * 데이터셋 스키마. 적재를 시작하면 테이블이 먼저 만들어지므로 적재 중에도 알 수 있고,
   * 등록하지 않은 데이터셋이면 null이다.
   */
  async schema(rows: RowSize): Promise<DatasetSchema | null> {
    const cached = this.#schemas.get(rows);
    if (cached) return cached;
    const status = await this.status(rows);
    if (status.state === "missing") return null;
    const schema = await readTableSchema(this.#db, readingsTable(rows));
    if (schema) this.#schemas.set(rows, schema);
    return schema;
  }

  /** 스키마와 고유값 수 (고유값은 준비가 끝난 뒤에만) */
  async columnInfo(rows: RowSize): Promise<ColumnInfo[] | null> {
    const schema = await this.schema(rows);
    if (!schema) return null;
    const stats = await this.#stats(rows);
    const distinct = new Map(stats?.map((s) => [s.name, s.distinct]));
    return schema.columns.map((c) => ({
      ...c,
      distinct: distinct.get(c.name) ?? null,
    }));
  }

  /** 준비가 끝난 데이터셋의 컬럼별 고유값 수. 아직이면 null */
  async #stats(rows: RowSize) {
    const res = await this.#db.query<Pick<MetaRow, "columns">>(
      "select columns from datasets where rows = $1 and status = 'ready'",
      [rows],
    );
    return res.rows[0]?.columns ?? null;
  }

  /** 준비가 끝났는지 (조회·집계를 받을 수 있는지) */
  async ready(rows: RowSize) {
    return (await this.#stats(rows)) !== null;
  }

  /**
   * split 조합 개수. 컬럼별 고유값의 곱이 상한이므로, 곱이 limit 이하면 쿼리 없이 그 값을 쓰고
   * 넘을 때만 실제 조합 수를 센다.
   */
  async splitCount(
    rows: RowSize,
    cols: string[],
    limit: number,
    filters?: ChartFilter[],
  ) {
    if (cols.length === 0) return { count: 1, exact: true };
    const schema = await this.schema(rows);
    const stats = await this.#stats(rows);
    if (!schema || !stats) throw new Error("dataset is not ready");
    const names = cols.map((c) => ident(columnOf(schema, c).name)).join(", ");
    // 필터가 있으면 고유값 곱으로 어림할 수 없으니 실제로 센다.
    if (filters && filters.length > 0) {
      const filter = filterSql(schema, filters);
      const res = await this.#db.query<{ count: number }>(
        `select count(*)::int as count from (select distinct ${names} from ${readingsTable(rows)} where true${filter.sql}) s`,
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
      `select count(*)::int as count from (select distinct ${names} from ${readingsTable(rows)}) s`,
    );
    return { count: res.rows[0].count, exact: true };
  }

  async #generate(rows: RowSize) {
    const started = performance.now();
    const table = readingsTable(rows);
    const progress = this.#progress.get(rows) as DatasetStatus;

    this.#schemas.delete(rows);
    await this.#db.exec(
      `drop table if exists ${table}; ${createReadingsSql(rows)};`,
    );
    await this.#db.query(
      `insert into datasets (rows, generator_version, status) values ($1, $2, 'generating')
       on conflict (rows) do update set generator_version = $2, status = 'generating', updated_at = now()`,
      [rows, GENERATOR_VERSION],
    );

    for (const chunk of generateCsvChunks(rows)) {
      await this.#db.query(
        `copy ${table} from '/dev/blob' with (format csv)`,
        [],
        {
          blob: new Blob([chunk.csv]),
        },
      );
      progress.done += chunk.rows;
    }

    progress.phase = "analyze";
    const columns = await this.#analyze(table);
    const generateMs = Math.round(performance.now() - started);
    await this.#db.query(
      `update datasets set status = 'ready', columns = $2, generate_ms = $3, updated_at = now()
       where rows = $1`,
      [rows, JSON.stringify(columns), generateMs],
    );
    this.#progress.delete(rows);
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
      "select rows, status, columns, generate_ms from datasets",
    );
    return new Map(res.rows.map((r) => [r.rows, r]));
  }

  #statusOf(rows: RowSize, meta: MetaRow | undefined): DatasetStatus {
    const progress = this.#progress.get(rows);
    if (progress) return { ...progress };
    if (meta?.status === "ready") {
      return {
        rows,
        state: "ready",
        done: rows,
        total: rows,
        generateMs: meta.generate_ms ?? undefined,
      };
    }
    return { rows, state: "missing", done: 0, total: rows };
  }
}
