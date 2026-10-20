// DB Worker 안에서 도는 데이터셋 관리자. 행 수별 테이블 생성, COPY 적재, 컬럼 통계를 맡는다.

import type { PGlite } from "@electric-sql/pglite";
import type { ColumnInfo, DatasetStatus } from "../api/types";
import { type ChartFilter, filterSql } from "./filters";
import { generateCsvChunks } from "./generator";
import {
  COLUMNS,
  type ColumnName,
  createReadingsSql,
  GENERATOR_VERSION,
  ROW_SIZES,
  type RowSize,
  readingsTable,
} from "./schema";

type MetaRow = {
  rows: RowSize;
  status: "generating" | "ready";
  columns: ColumnInfo[] | null;
  generate_ms: number | null;
};

export class DatasetManager {
  readonly #db: PGlite;
  /** 생성 중인 데이터셋의 진행 상태. DB를 거치지 않고 바로 응답하기 위해 메모리에 둔다. */
  readonly #progress = new Map<RowSize, DatasetStatus>();
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

  async columns(rows: RowSize) {
    const res = await this.#db.query<Pick<MetaRow, "columns">>(
      "select columns from datasets where rows = $1 and status = 'ready'",
      [rows],
    );
    return res.rows[0]?.columns ?? null;
  }

  /**
   * split 조합 개수. 컬럼별 고유값의 곱이 상한이므로, 곱이 limit 이하면 쿼리 없이 그 값을 쓰고
   * 넘을 때만 실제 조합 수를 센다.
   */
  async splitCount(
    rows: RowSize,
    cols: ColumnName[],
    limit: number,
    filters?: ChartFilter[],
  ) {
    if (cols.length === 0) return { count: 1, exact: true };
    const columns = await this.columns(rows);
    if (!columns) throw new Error("dataset is not ready");
    // 필터가 있으면 고유값 곱으로 어림할 수 없으니 실제로 센다.
    if (filters && filters.length > 0) {
      const filter = filterSql(filters);
      const res = await this.#db.query<{ count: number }>(
        `select count(*)::int as count from (select distinct ${cols.join(", ")} from ${readingsTable(rows)} where true${filter.sql}) s`,
        filter.params,
      );
      return { count: res.rows[0].count, exact: true };
    }
    const distinct = new Map(columns.map((c) => [c.name, c.distinct]));
    const upper = cols.reduce(
      (acc, c) => acc * (distinct.get(c) ?? Infinity),
      1,
    );
    if (cols.length === 1) return { count: upper, exact: true };
    if (upper <= limit) return { count: upper, exact: false };
    const res = await this.#db.query<{ count: number }>(
      `select count(*)::int as count from (select distinct ${cols.join(", ")} from ${readingsTable(rows)}) s`,
    );
    return { count: res.rows[0].count, exact: true };
  }

  async #generate(rows: RowSize) {
    const started = performance.now();
    const table = readingsTable(rows);
    const progress = this.#progress.get(rows) as DatasetStatus;

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

  /** 컬럼별 고유값 개수. split by의 30,000개 제한을 미리 판단하는 데 쓴다. */
  async #analyze(table: string): Promise<ColumnInfo[]> {
    const select = COLUMNS.map(
      (c) => `count(distinct ${c.name})::int as ${c.name}`,
    ).join(", ");
    const res = await this.#db.query<Record<string, number>>(
      `select ${select} from ${table}`,
    );
    const counts = res.rows[0];
    return COLUMNS.map((c) => ({ ...c, distinct: counts[c.name] }));
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
