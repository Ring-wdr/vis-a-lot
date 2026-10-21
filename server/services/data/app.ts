// data 서비스: 데이터셋 적재(샘플 생성, CSV 업로드)와 메타 조회. DB(PGlite worker)에 쓰는 유일한 서비스다.

import type { CsvOptions } from "../../data/csv-import";
import { MAX_SPLIT_ITEMS } from "../../data/schema";
import { getRuntime } from "../../runtime";
import { apiError, createServiceApp } from "../common/http";
import * as routes from "./routes";
import { CsvOptionsSchema } from "./schemas";

const db = () => getRuntime().db;

/** 적재가 끝나 조회·집계를 받을 수 있는지 */
function isReady(dataset: string) {
  return db().call("datasetReady", { dataset });
}

/** 스키마에서 컬럼 하나를 찾는다. 등록하지 않았거나 없는 컬럼이면 undefined */
async function columnOf(dataset: string, name: string) {
  const columns = await db().call("datasetColumns", { dataset });
  return columns?.find((c) => c.name === name);
}

/** multipart의 options 필드(JSON 문자열)를 검사한다. */
function parseOptions(raw: string): CsvOptions | string {
  try {
    const parsed = CsvOptionsSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data;
    return `options: ${parsed.error.issues[0]?.message ?? "invalid"}`;
  } catch {
    return "options: invalid json";
  }
}

export const dataApp = createServiceApp()
  .openapi(routes.listDatasets, async (c) => {
    const datasets = await db().call("datasetStatuses", undefined);
    return c.json({ datasets }, 200);
  })
  .openapi(routes.datasetStatus, async (c) => {
    const { datasetId } = c.req.valid("param");
    const status = await db().call("datasetStatus", { id: datasetId });
    if (!status) return apiError(c, 404, "unknown dataset");
    return c.json(status, 200);
  })
  .openapi(routes.generateDataset, async (c) => {
    const { datasetId } = c.req.valid("param");
    const status = await db().call("ensureDataset", { id: datasetId });
    if (!status) return apiError(c, 404, "unknown dataset");
    return c.json(status, 202);
  })
  .openapi(routes.uploadDataset, async (c) => {
    const { file, name, options: raw } = c.req.valid("form");
    const options = parseOptions(raw);
    if (typeof options === "string") return apiError(c, 400, options);
    const bytes = await file.arrayBuffer();
    const result = await db().call(
      "uploadDataset",
      { name, fileName: file.name, bytes, options },
      { transfer: [bytes] },
    );
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.status, 202);
  })
  .openapi(routes.editDataset, async (c) => {
    const { datasetId } = c.req.valid("param");
    const patch = c.req.valid("json");
    const result = await db().call("editDataset", { id: datasetId, ...patch });
    if (!result) return apiError(c, 404, "unknown upload dataset");
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.status, 200);
  })
  .openapi(routes.deleteDataset, async (c) => {
    const { datasetId } = c.req.valid("param");
    const result = await db().call("removeDataset", { id: datasetId });
    if (result === "missing") return apiError(c, 404, "unknown upload dataset");
    if (result === "busy")
      return apiError(c, 409, "적재 중에는 지울 수 없습니다.");
    return c.body(null, 204);
  })
  .openapi(routes.schema, async (c) => {
    const { datasetId } = c.req.valid("param");
    const columns = await db().call("datasetColumns", { dataset: datasetId });
    if (!columns) return apiError(c, 409, "dataset is not registered");
    return c.json(
      { id: datasetId, ready: await isReady(datasetId), columns },
      200,
    );
  })
  .openapi(routes.splitCount, async (c) => {
    const { datasetId } = c.req.valid("param");
    const { cols, filters } = c.req.valid("json");
    if (!(await isReady(datasetId)))
      return apiError(c, 409, "dataset is not ready");
    const result = await db().call("splitCount", {
      dataset: datasetId,
      cols,
      limit: MAX_SPLIT_ITEMS,
      filters,
    });
    return c.json({ ...result, limit: MAX_SPLIT_ITEMS }, 200);
  })
  .openapi(routes.columnSummary, async (c) => {
    const { datasetId, column } = c.req.valid("param");
    if (!(await isReady(datasetId)))
      return apiError(c, 409, "dataset is not ready");
    if (!(await columnOf(datasetId, column)))
      return apiError(c, 400, `unknown column ${column}`);
    return c.json(
      await db().call("columnSummary", { dataset: datasetId, column }),
      200,
    );
  })
  .openapi(routes.legendValues, async (c) => {
    const { datasetId } = c.req.valid("param");
    const { column } = c.req.valid("query");
    if (!(await isReady(datasetId)))
      return apiError(c, 409, "dataset is not ready");
    if ((await columnOf(datasetId, column))?.type !== "categorical")
      return apiError(c, 400, `${column} is not a categorical column`);
    const values = await db().call("legendValues", {
      dataset: datasetId,
      column,
    });
    return c.json({ column, values }, 200);
  })
  .openapi(routes.health, async (c) => {
    const info = await db().call("ping", undefined);
    return c.json({ service: "data" as const, db: info }, 200);
  });
