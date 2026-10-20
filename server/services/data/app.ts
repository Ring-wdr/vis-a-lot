// data 서비스: 데이터셋 적재와 메타 조회. DB(PGlite worker)에 쓰는 유일한 서비스다.

import { MAX_SPLIT_ITEMS, type RowSize } from "../../data/schema";
import { getRuntime } from "../../runtime";
import { apiError, createServiceApp } from "../common/http";
import * as routes from "./routes";

const db = () => getRuntime().db;

/** 적재가 끝나 조회·집계를 받을 수 있는지 */
function isReady(rows: RowSize) {
  return db().call("datasetReady", { rows });
}

/** 스키마에서 컬럼 하나를 찾는다. 등록하지 않았거나 없는 컬럼이면 undefined */
async function columnOf(rows: RowSize, name: string) {
  const columns = await db().call("datasetColumns", { rows });
  return columns?.find((c) => c.name === name);
}

export const dataApp = createServiceApp()
  .openapi(routes.listDatasets, async (c) => {
    const datasets = await db().call("datasetStatuses", undefined);
    return c.json({ datasets }, 200);
  })
  .openapi(routes.generateDataset, async (c) => {
    const { rows } = c.req.valid("json");
    const status = await db().call("ensureDataset", { rows });
    return c.json(status, 202);
  })
  .openapi(routes.schema, async (c) => {
    const { rows } = c.req.valid("query");
    const columns = await db().call("datasetColumns", { rows });
    if (!columns) return apiError(c, 409, "dataset is not registered");
    return c.json({ rows, ready: await isReady(rows), columns }, 200);
  })
  .openapi(routes.splitCount, async (c) => {
    const { rows, cols, filters } = c.req.valid("json");
    if (!(await isReady(rows))) return apiError(c, 409, "dataset is not ready");
    const result = await db().call("splitCount", {
      rows,
      cols,
      limit: MAX_SPLIT_ITEMS,
      filters,
    });
    return c.json({ ...result, limit: MAX_SPLIT_ITEMS }, 200);
  })
  .openapi(routes.columnSummary, async (c) => {
    const { column } = c.req.valid("param");
    const { rows } = c.req.valid("query");
    if (!(await isReady(rows))) return apiError(c, 409, "dataset is not ready");
    if (!(await columnOf(rows, column)))
      return apiError(c, 400, `unknown column ${column}`);
    return c.json(await db().call("columnSummary", { rows, column }), 200);
  })
  .openapi(routes.legendValues, async (c) => {
    const { rows, column } = c.req.valid("query");
    if (!(await isReady(rows))) return apiError(c, 409, "dataset is not ready");
    if ((await columnOf(rows, column))?.type !== "categorical")
      return apiError(c, 400, `${column} is not a categorical column`);
    const values = await db().call("legendValues", { rows, column });
    return c.json({ column, values }, 200);
  })
  .openapi(routes.health, async (c) => {
    const info = await db().call("ping", undefined);
    return c.json({ service: "data" as const, db: info }, 200);
  });
