// data 서비스: 데이터셋 적재와 메타 조회. DB(PGlite worker)에 쓰는 유일한 서비스다.

import { MAX_SPLIT_ITEMS, type RowSize } from "../../data/schema";
import { getRuntime } from "../../runtime";
import { apiError, createServiceApp } from "../common/http";
import * as routes from "./routes";

const db = () => getRuntime().db;

/** 준비된 데이터셋의 컬럼 통계. 아직 적재 중이면 null */
function readyColumns(rows: RowSize) {
  return db().call("datasetColumns", { rows });
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
  .openapi(routes.columns, async (c) => {
    const { rows } = c.req.valid("query");
    const columns = await readyColumns(rows);
    if (!columns) return apiError(c, 409, "dataset is not ready");
    return c.json({ rows, columns }, 200);
  })
  .openapi(routes.splitCount, async (c) => {
    const { rows, cols } = c.req.valid("query");
    if (!(await readyColumns(rows)))
      return apiError(c, 409, "dataset is not ready");
    const result = await db().call("splitCount", {
      rows,
      cols,
      limit: MAX_SPLIT_ITEMS,
    });
    return c.json({ ...result, limit: MAX_SPLIT_ITEMS }, 200);
  })
  .openapi(routes.legendValues, async (c) => {
    const { rows, column } = c.req.valid("query");
    if (!(await readyColumns(rows)))
      return apiError(c, 409, "dataset is not ready");
    const values = await db().call("legendValues", { rows, column });
    return c.json({ column, values }, 200);
  })
  .openapi(routes.health, async (c) => {
    const info = await db().call("ping", undefined);
    return c.json({ service: "data" as const, db: info }, 200);
  });
