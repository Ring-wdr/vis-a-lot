// DB Worker 안에서 도는 데이터셋 관리자. 샘플(생성기) 데이터셋과 업로드한 CSV 데이터셋의 테이블 생성,
// COPY 적재, 컬럼 통계를 맡는다. 데이터셋은 id로 구분하고, 테이블 이름은 메타에 적어 둔다.
// 메타(dataset_meta)는 Kysely 빌더로, 컬럼이 정해지지 않은 데이터셋 테이블은 sql 조각으로 다룬다.

import { del, get, set } from "idb-keyval";
import { type Selectable, sql } from "kysely";
import type {
  CsvCheck,
  DatasetStatus,
  StagedUpload,
  UploadInfo,
  UploadTask,
} from "../api/types";
import type { DatasetMetaTable, Db, Sql } from "../db/database";
import { copyFrom } from "../db/pglite-native";
import {
  type CsvFile,
  type CsvOptions,
  type CsvPreview,
  CsvRejectError,
  extractCsvFiles,
  type InspectedCsv,
  inspectCsv,
  previewCsv,
  tableColumnsOf,
  withDefaults,
} from "./csv-import";
import {
  allOf,
  type ColumnSchema,
  columnOf,
  type DatasetSchema,
  ident,
  type LogicalType,
  list,
  readTableSchema,
  tableSql,
} from "./dataset-schema";
import { type ChartFilter, filterSql } from "./filters";
import { generateCsvChunks } from "./generator";
import {
  COLUMNS,
  type ColumnType,
  GENERATOR_VERSION,
  type RowSize,
  readingsTable,
  SAMPLES,
  sampleIdOf,
  sampleOf,
} from "./schema";

/** 적재가 끝난 뒤 센 컬럼별 고유값 수 */
export type ColumnStat = { name: string; distinct: number };

/** 스키마 + 고유값 수. 고유값은 적재가 끝나야 알 수 있어 그 전에는 null이다. */
export type ColumnInfo = ColumnSchema & { distinct: number | null };

/** 메타에서 읽는 컬럼 */
const META_COLUMNS = [
  "id",
  "kind",
  "name",
  "tbl",
  "status",
  "columns",
  "row_count",
  "generate_ms",
  "upload",
  "error",
] as const;

type MetaRow = Pick<
  Selectable<DatasetMetaTable>,
  (typeof META_COLUMNS)[number]
>;

/** 메타에 남기는 업로드 정보 (원본 파일은 IndexedDB에 따로 둔다) */
export type StoredUpload = Omit<UploadInfo, "createdAt"> & {
  createdAt: number;
};

/** 올려 둔 파일. 확인(commit)하거나 버릴 때까지 메모리에 둔다. */
type Stage = { info: StagedUpload; files: CsvFile[] };

/** 동시에 올려 둘 수 있는 파일 수. 넘으면 가장 오래된 것부터 버린다. */
const MAX_STAGES = 3;
/** long polling 한 번이 기다리는 최대 시간 */
const TASK_WAIT_MS = 15_000;

type Chunks = Iterable<{ csv: string; rows: number }>;

const rawKey = (id: string) => `upload:${id}`;

/** 업로드 테이블의 컬럼 타입 */
const SQL_TYPES: Record<LogicalType, Sql> = {
  numeric: sql`double precision`,
  datetime: sql`timestamptz`,
  categorical: sql`text`,
};

/** 샘플(생성기) 테이블의 컬럼 타입 */
const READINGS_TYPES: Record<ColumnType, Sql> = {
  time: sql`timestamptz not null`,
  string: sql`text not null`,
  number: sql`double precision`,
};

/** 샘플 테이블과, 화면에 보일 컬럼 라벨(컬럼 주석)을 만드는 문장들 */
function createReadingsSql(rows: RowSize): Sql[] {
  const table = readingsTable(rows);
  const cols = COLUMNS.map(
    (c) => sql`${ident(c.name)} ${READINGS_TYPES[c.type]}`,
  );
  // comment on은 바인딩을 받지 않으므로 라벨은 글자로 넣는다.
  const comments = COLUMNS.map(
    (c) =>
      sql`comment on column ${sql.id(table, c.name)} is ${sql.lit(c.label)}`,
  );
  return [sql`create table ${tableSql(table)} (${list(cols)})`, ...comments];
}

export class DatasetManager {
  readonly #db: Db;
  /** 적재 중인 데이터셋의 진행 상태. DB를 거치지 않고 바로 응답하기 위해 메모리에 둔다. */
  readonly #progress = new Map<string, DatasetStatus>();
  /** 테이블 스키마. 테이블을 다시 만들 때만 바뀌므로 만들 때 지운다. */
  readonly #schemas = new Map<string, DatasetSchema>();
  #queue: Promise<void> = Promise.resolve();
  readonly #stages = new Map<string, Stage>();
  /** 확인을 누른 업로드의 진행. stageId로 찾는다. */
  readonly #tasks = new Map<string, Omit<UploadTask, "version">>();
  /** 진행이 바뀔 때마다 오른다. 업로드 진행 long polling이 이 값으로 바뀐 것을 안다. */
  #version = 0;
  readonly #waiters = new Set<() => void>();

  private constructor(db: Db) {
    this.#db = db;
  }

  static async open(db: Db) {
    await db.schema
      .createTable("dataset_meta")
      .ifNotExists()
      .addColumn("id", "text", (c) => c.primaryKey())
      .addColumn("kind", "text", (c) => c.notNull())
      .addColumn("name", "text", (c) => c.notNull())
      .addColumn("tbl", "text", (c) => c.notNull())
      .addColumn("status", "text", (c) => c.notNull())
      .addColumn("generator_version", "integer")
      .addColumn("columns", "jsonb")
      .addColumn("row_count", "integer")
      .addColumn("generate_ms", "integer")
      .addColumn("upload", "jsonb")
      .addColumn("error", "text")
      .addColumn("created_at", "timestamptz", (c) =>
        c.notNull().defaultTo(sql`now()`),
      )
      .addColumn("updated_at", "timestamptz", (c) =>
        c.notNull().defaultTo(sql`now()`),
      )
      .execute();
    await migrateRowsMeta(db);
    // 적재 도중 새로고침된 데이터셋은 다시 만들 수 없으니 버린다. 샘플은 생성기 버전이 바뀌어도 버린다.
    // 업로드는 원본이 남아 있으므로 실패로 남겨 두고 '수정'으로 다시 적재할 수 있게 한다.
    const stale = await db
      .selectFrom("dataset_meta")
      .select(["id", "kind", "tbl"])
      .where((eb) =>
        eb.or([
          eb("status", "=", "generating"),
          eb.and([
            eb("kind", "=", "sample"),
            eb("generator_version", "<>", GENERATOR_VERSION),
          ]),
        ]),
      )
      .execute();
    for (const { id, kind, tbl } of stale) {
      await db.schema.dropTable(tbl).ifExists().execute();
      if (kind === "sample") {
        await db.deleteFrom("dataset_meta").where("id", "=", id).execute();
      } else {
        await db
          .updateTable("dataset_meta")
          .set({
            status: "failed",
            error: "적재 도중 중단되었습니다. 수정으로 다시 적재하세요.",
          })
          .where("id", "=", id)
          .execute();
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
      await this.#db
        .insertInto("dataset_meta")
        .values({
          id,
          kind: "sample",
          name: sample.name,
          tbl: table,
          status: "generating",
          generator_version: GENERATOR_VERSION,
        })
        .onConflict((oc) =>
          oc.column("id").doUpdateSet({
            status: "generating",
            generator_version: GENERATOR_VERSION,
            updated_at: sql<Date>`now()`,
          }),
        )
        .execute();
      await this.#fill(
        id,
        table,
        createReadingsSql(sample.rows),
        generateCsvChunks(sample.rows),
      );
    });
    return queued;
  }

  /** 파일을 올려 둔다. zip이면 안의 CSV를 꺼내 두고, 미리보기·검사·확인은 stageId로 한다. */
  async stage(file: CsvFile): Promise<StagedUpload> {
    const files = await extractCsvFiles(file);
    return this.#keepStage(file.name, file.bytes.byteLength, files);
  }

  /** 업로드한 데이터셋을 다시 적재(수정)하려고 보관해 둔 원본을 올려 둔다. 모르는 데이터셋이면 null */
  async stageExisting(id: string): Promise<StagedUpload | null> {
    const meta = await this.#metaOf(id);
    if (meta?.kind !== "upload" || !meta.upload) return null;
    const stored = await get<{ name: string; blob: Blob }[]>(rawKey(id));
    if (!stored) {
      throw new CsvRejectError("원본 파일이 없어 다시 적재할 수 없습니다.");
    }
    const files = await Promise.all(
      stored.map(async (f) => ({
        name: f.name,
        bytes: new Uint8Array(await f.blob.arrayBuffer()),
      })),
    );
    return this.#keepStage(meta.upload.fileName, meta.upload.size, files, {
      id,
      name: meta.name,
      options: withDefaults(meta.upload.options),
    });
  }

  #keepStage(
    fileName: string,
    size: number,
    files: CsvFile[],
    dataset?: StagedUpload["dataset"],
  ) {
    const stageId = `st-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const info: StagedUpload = {
      stageId,
      fileName,
      size,
      files: files.map((f) => ({ name: f.name, size: f.bytes.byteLength })),
      dataset,
    };
    this.#stages.set(stageId, { info, files });
    while (this.#stages.size > MAX_STAGES) {
      this.#stages.delete(this.#stages.keys().next().value as string);
    }
    return info;
  }

  #stageOf(stageId: string) {
    const stage = this.#stages.get(stageId);
    if (!stage) {
      throw new CsvRejectError(
        "올려 둔 파일이 없습니다. 파일을 다시 선택하세요.",
      );
    }
    return stage;
  }

  /** 올려 둔 파일을 버린다 (팝업을 닫을 때). */
  discardStage(stageId: string) {
    this.#stages.delete(stageId);
  }

  /** 올려 둔 파일 중 하나(file 번째 CSV)의 앞부분 미리보기 */
  async preview(
    stageId: string,
    file: number,
    options: CsvOptions,
  ): Promise<CsvPreview> {
    const { files } = this.#stageOf(stageId);
    const target = files[file];
    if (!target) throw new CsvRejectError(`${file}번째 파일이 없습니다.`);
    return previewCsv(target, options);
  }

  /** 적재하지 않고 파일 전체를 검사한다. 거절되면 CsvRejectError */
  async check(stageId: string, options: CsvOptions): Promise<CsvCheck> {
    const { files } = this.#stageOf(stageId);
    const inspected = await inspectCsv(files, options);
    return {
      rows: inspected.rows,
      skipped: inspected.skipped,
      columns: inspected.columns,
    };
  }

  /**
   * 올려 둔 파일을 적재한다. 검사·변환부터 백그라운드에서 하고 진행은 task로 알린다.
   * 수정(기존 데이터셋)이면 검사에서 거절될 때 지금 데이터를 그대로 둔다.
   */
  commit(
    stageId: string,
    input: { name: string; options: CsvOptions },
  ): UploadTask {
    const stage = this.#stageOf(stageId);
    if (this.#tasks.get(stageId)?.state === "parse") {
      throw new CsvRejectError("이미 적재를 시작했습니다.");
    }
    const replace = stage.info.dataset?.id;
    if (replace && this.#progress.has(replace)) {
      throw new CsvRejectError("적재 중에는 수정할 수 없습니다.");
    }
    const task: Omit<UploadTask, "version"> = {
      state: "parse",
      done: 0,
      total: 1,
    };
    this.#tasks.set(stageId, task);
    this.#notify();

    let last = 0;
    const onProgress = (done: number, total: number) => {
      task.done = done;
      task.total = total;
      // 너무 잦은 깨우기는 피한다 (1% 단위).
      if (done - last >= total / 100 || done === total) {
        last = done;
        this.#notify();
      }
    };

    (async () => {
      const inspected = await inspectCsv(
        stage.files,
        input.options,
        onProgress,
      );
      const upload: StoredUpload = {
        fileName: stage.info.fileName,
        size: stage.info.size,
        files: stage.info.files,
        createdAt: Date.now(),
        options: input.options,
        inferred: inspected.columns.map((c) => ({
          name: c.name,
          type: c.inferred,
        })),
      };
      let id: string;
      if (replace) {
        id = replace;
        const meta = await this.#metaOf(id);
        await this.#db
          .updateTable("dataset_meta")
          .set({
            name: input.name,
            upload: JSON.stringify({
              ...upload,
              createdAt: meta?.upload?.createdAt ?? upload.createdAt,
            }),
            status: "generating",
            error: null,
            columns: null,
            updated_at: sql<Date>`now()`,
          })
          .where("id", "=", id)
          .execute();
      } else {
        id = `up-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
        await set(
          rawKey(id),
          stage.files.map((f) => ({
            name: f.name,
            blob: new Blob([f.bytes.slice()]),
          })),
        );
        await this.#db
          .insertInto("dataset_meta")
          .values({
            id,
            kind: "upload",
            name: input.name,
            tbl: uploadTable(id),
            status: "generating",
            upload: JSON.stringify(upload),
          })
          .execute();
      }
      task.datasetId = id;
      this.#stages.delete(stageId);
      this.#import(id, input.name, inspected);
    })().catch((err) => {
      task.state = "rejected";
      task.error = err instanceof Error ? err.message : String(err);
      if (!(err instanceof CsvRejectError))
        console.error(`upload ${stageId} failed`, err);
      this.#notify();
    });
    return this.#taskSnapshot(stageId) as UploadTask;
  }

  /** 업로드 진행. since와 같은 버전이면 바뀔 때까지(최대 15초) 기다린다. 모르는 stageId면 null */
  async waitTask(stageId: string, since?: number): Promise<UploadTask | null> {
    const deadline = Date.now() + TASK_WAIT_MS;
    for (;;) {
      const snapshot = await this.#taskStatus(stageId);
      if (!snapshot || snapshot.version !== since || Date.now() >= deadline)
        return snapshot;
      await new Promise<void>((resolve) => {
        const wake = () => {
          clearTimeout(timer);
          this.#waiters.delete(wake);
          resolve();
        };
        const timer = setTimeout(wake, deadline - Date.now());
        this.#waiters.add(wake);
      });
    }
  }

  /** 적재가 시작된 뒤에는 데이터셋 진행(copy·analyze)과 결과로 task 상태를 정한다. */
  async #taskStatus(stageId: string): Promise<UploadTask | null> {
    const task = this.#tasks.get(stageId);
    if (!task) return null;
    if (task.datasetId && task.state === "parse") {
      const progress = this.#progress.get(task.datasetId);
      if (progress) {
        const copying = progress.phase === "analyze" ? "analyze" : "copy";
        return {
          ...task,
          state: progress.done === 0 && copying === "copy" ? "queued" : copying,
          done: progress.done,
          total: progress.total,
          version: this.#version,
        };
      }
      const meta = await this.#metaOf(task.datasetId);
      if (meta?.status === "ready") task.state = "done";
      else if (meta?.status === "failed") {
        task.state = "failed";
        task.error = meta.error ?? undefined;
      }
    }
    return this.#taskSnapshot(stageId);
  }

  #taskSnapshot(stageId: string): UploadTask | null {
    const task = this.#tasks.get(stageId);
    return task ? { ...task, version: this.#version } : null;
  }

  #notify() {
    this.#version++;
    for (const wake of [...this.#waiters]) wake();
  }

  /** 업로드한 데이터셋의 이름을 바꾼다. 모르는 데이터셋이면 null */
  async rename(id: string, name: string): Promise<DatasetStatus | null> {
    const meta = await this.#metaOf(id);
    if (meta?.kind !== "upload") return null;
    await this.#db
      .updateTable("dataset_meta")
      .set({ name, updated_at: sql<Date>`now()` })
      .where("id", "=", id)
      .execute();
    return this.#statusOf(id, { ...meta, name });
  }

  /** 업로드한 데이터셋을 지운다. 적재 중이면 지우지 않는다. */
  async remove(id: string): Promise<"removed" | "busy" | "missing"> {
    const meta = await this.#metaOf(id);
    if (meta?.kind !== "upload") return "missing";
    if (this.#progress.has(id)) return "busy";
    await this.#db.schema.dropTable(meta.tbl).ifExists().execute();
    await this.#db.deleteFrom("dataset_meta").where("id", "=", id).execute();
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
    const row = await this.#db
      .selectFrom("dataset_meta")
      .select("columns")
      .where("id", "=", id)
      .where("status", "=", "ready")
      .executeTakeFirst();
    return row?.columns ?? null;
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
    const names = list(cols.map((c) => ident(columnOf(schema, c).name)));
    const from = tableSql(table);
    // 필터가 있으면 고유값 곱으로 어림할 수 없으니 실제로 센다.
    if (filters && filters.length > 0) {
      const where = allOf([sql`true`, ...filterSql(schema, filters)]);
      const res = await sql<{
        count: number;
      }>`select count(*)::int as count from (select distinct ${names} from ${from} where ${where}) s`.execute(
        this.#db,
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
    const res = await sql<{
      count: number;
    }>`select count(*)::int as count from (select distinct ${names} from ${from}) s`.execute(
      this.#db,
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
          .updateTable("dataset_meta")
          .set({ status: "failed", error: `적재 실패: ${message}` })
          .where("id", "=", id)
          .where("kind", "=", "upload")
          .execute()
          .catch(() => undefined);
        this.#notify();
        await this.#db
          .deleteFrom("dataset_meta")
          .where("id", "=", id)
          .where("kind", "=", "sample")
          .execute()
          .catch(() => undefined);
      }),
    );
  }

  #import(id: string, name: string, inspected: InspectedCsv) {
    const queued = this.#queued(id, "upload", name, inspected.rows);
    const table = uploadTable(id);
    const cols = tableColumnsOf(inspected).map(
      (c) => sql`${ident(c.name)} ${SQL_TYPES[c.type]}`,
    );
    this.#enqueue(id, () =>
      this.#fill(
        id,
        table,
        [sql`create table ${tableSql(table)} (${list(cols)})`],
        inspected.chunks,
      ),
    );
    return { ...queued };
  }

  /** 테이블을 다시 만들고(지우기·만들기는 예전 exec 한 번처럼 한 트랜잭션) CSV 조각을 COPY로 적재한다. */
  async #fill(id: string, table: string, create: Sql[], chunks: Chunks) {
    const started = performance.now();
    const progress = this.#progress.get(id) as DatasetStatus;

    this.#schemas.delete(id);
    await this.#db.transaction().execute(async (trx) => {
      await trx.schema.dropTable(table).ifExists().execute();
      for (const statement of create) await statement.execute(trx);
    });

    for (const chunk of chunks) {
      await copyFrom(this.#db, table, new Blob([chunk.csv]));
      progress.done += chunk.rows;
      this.#notify();
    }

    progress.phase = "analyze";
    this.#notify();
    const columns = await this.#analyze(table);
    const generateMs = Math.round(performance.now() - started);
    await this.#db
      .updateTable("dataset_meta")
      .set({
        status: "ready",
        columns: JSON.stringify(columns),
        row_count: progress.done,
        generate_ms: generateMs,
        error: null,
        updated_at: sql<Date>`now()`,
      })
      .where("id", "=", id)
      .execute();
    this.#progress.delete(id);
    this.#notify();
  }

  /**
   * 컬럼별 고유값 개수. split by의 30,000개 제한을 미리 판단하고, legend로 쓸 수 있는지
   * (범주이고 8개 이하) 정하는 데 쓴다. 컬럼은 테이블 스키마에서 읽는다.
   */
  async #analyze(table: string): Promise<ColumnStat[]> {
    const schema = await readTableSchema(this.#db, table);
    if (!schema) throw new Error(`table ${table} not found`);
    // 결과 키는 순서대로 c0, c1 …로 받는다 (이름에 무엇이 들어 있어도 된다).
    const select = list(
      schema.columns.map(
        (c, i) =>
          sql`count(distinct ${ident(c.name)})::int as ${sql.id(`c${i}`)}`,
      ),
    );
    const res = await sql<
      Record<string, number>
    >`select ${select} from ${tableSql(table)}`.execute(this.#db);
    const counts = res.rows[0];
    return schema.columns.map((c, i) => ({
      name: c.name,
      distinct: counts[`c${i}`],
    }));
  }

  async #meta() {
    const rows = await this.#db
      .selectFrom("dataset_meta")
      .select(META_COLUMNS)
      .execute();
    return new Map(rows.map((r) => [r.id, r]));
  }

  async #metaOf(id: string): Promise<MetaRow | undefined> {
    return this.#db
      .selectFrom("dataset_meta")
      .select(META_COLUMNS)
      .where("id", "=", id)
      .executeTakeFirst();
  }

  #statusOf(id: string, meta: MetaRow | undefined): DatasetStatus {
    const progress = this.#progress.get(id);
    // 예전에 저장한 옵션에는 나중에 생긴 항목이 없다.
    const upload = meta?.upload
      ? { ...meta.upload, options: withDefaults(meta.upload.options) }
      : undefined;
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
async function migrateRowsMeta(db: Db) {
  const old = await sql<{
    exists: boolean;
  }>`select to_regclass('datasets') is not null as exists`.execute(db);
  if (!old.rows[0].exists) return;
  const rows = await db
    .selectFrom("datasets")
    .select(["rows", "generator_version", "status", "columns", "generate_ms"])
    .where("status", "=", "ready")
    .execute();
  for (const r of rows) {
    const id = sampleIdOf(r.rows);
    const sample = id && sampleOf(id);
    if (!sample) continue;
    await db
      .insertInto("dataset_meta")
      .values({
        id,
        kind: "sample",
        name: sample.name,
        tbl: readingsTable(sample.rows),
        status: "ready",
        generator_version: r.generator_version,
        columns: JSON.stringify(r.columns),
        row_count: r.rows,
        generate_ms: r.generate_ms,
      })
      .onConflict((oc) => oc.column("id").doNothing())
      .execute();
  }
  await db.schema.dropTable("datasets").execute();
}
