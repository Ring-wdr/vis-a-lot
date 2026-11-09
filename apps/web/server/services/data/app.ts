// data 서비스: 데이터셋 적재(샘플 생성, CSV 업로드)와 메타 조회. DB(PGlite worker)에 쓰는 유일한 서비스다.

import { MAX_SPLIT_ITEMS } from "../../data/schema";
import { getRuntime } from "../../runtime";
import { apiError, createServiceApp } from "../common/http";
import * as routes from "./routes";

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
  .openapi(routes.stageUpload, async (c) => {
    const { file } = c.req.valid("form");
    const bytes = await file.arrayBuffer();
    const result = await db().call(
      "stageUpload",
      { fileName: file.name, bytes },
      { transfer: [bytes] },
    );
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.value, 201);
  })
  .openapi(routes.stageDataset, async (c) => {
    const { datasetId } = c.req.valid("param");
    const result = await db().call("stageDataset", { id: datasetId });
    if (!result) return apiError(c, 404, "unknown upload dataset");
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.value, 201);
  })
  .openapi(routes.discardStage, async (c) => {
    await db().call("discardStage", c.req.valid("param"));
    return c.body(null, 204);
  })
  .openapi(routes.previewUpload, async (c) => {
    const { stageId } = c.req.valid("param");
    const result = await db().call("previewUpload", {
      stageId,
      ...c.req.valid("json"),
    });
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.value, 200);
  })
  .openapi(routes.checkUpload, async (c) => {
    const { stageId } = c.req.valid("param");
    const { options } = c.req.valid("json");
    const result = await db().call("checkUpload", { stageId, options });
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.value, 200);
  })
  .openapi(routes.commitUpload, async (c) => {
    const { stageId } = c.req.valid("param");
    const result = await db().call("commitUpload", {
      stageId,
      ...c.req.valid("json"),
    });
    if (!result.ok) return apiError(c, 422, result.error);
    return c.json(result.value, 202);
  })
  .openapi(routes.uploadTask, async (c) => {
    const { stageId } = c.req.valid("param");
    const { since } = c.req.valid("query");
    const task = await db().call("uploadTask", { stageId, since });
    if (!task) return apiError(c, 404, "unknown upload task");
    return c.json(task, 200);
  })
  .openapi(routes.renameDataset, async (c) => {
    const { datasetId } = c.req.valid("param");
    const { name } = c.req.valid("json");
    const status = await db().call("renameDataset", { id: datasetId, name });
    if (!status) return apiError(c, 404, "unknown upload dataset");
    return c.json(status, 200);
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
    if (!columns) {
      // 모르는 데이터셋(지운 업로드)과 아직 등록하지 않은 샘플을 상태 코드로 나눈다.
      const status = await db().call("datasetStatus", { id: datasetId });
      if (!status) return apiError(c, 404, "unknown dataset");
      return apiError(c, 409, "dataset is not registered");
    }
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
