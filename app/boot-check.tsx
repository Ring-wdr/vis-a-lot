"use client";

import { useState } from "react";
import { ChartImage } from "@/components/ChartImage";
import { DatasetPanel } from "@/components/DatasetPanel";
import { useHealth } from "@/lib/queries";
import type {
  DebugRenderRequest,
  DebugRenderResponse,
} from "@/server/api/types";
import type { RowSize } from "@/server/data/schema";
import styles from "./page.module.css";

const ITEM_COUNT = 8;
const WIDTH = 320;
const HEIGHT = 200;

type Item = { key: string; result?: DebugRenderResponse; error?: string };

/** 구조 검증 페이지: DB Worker 부팅, 데이터 생성, Render Worker 병렬 렌더, `<img>` → MSW → Cache API 경로. */
export function BootCheck() {
  const { data: health, error: healthError } = useHealth();
  const [rows, setRows] = useState<RowSize>(100_000);
  const [items, setItems] = useState<Item[]>([]);
  const [points, setPoints] = useState(50_000);
  const [totalMs, setTotalMs] = useState<number>();

  async function renderAll() {
    const keys = Array.from({ length: ITEM_COUNT }, (_, i) => `item-${i + 1}`);
    setItems(keys.map((key) => ({ key })));
    setTotalMs(undefined);
    const started = performance.now();

    await Promise.all(
      keys.map(async (key) => {
        try {
          const res = await fetch("/api/debug/render", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chartId: "boot-check",
              itemKey: key,
              width: WIDTH,
              height: HEIGHT,
              points,
            } satisfies DebugRenderRequest),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const result = (await res.json()) as DebugRenderResponse;
          setItems((prev) =>
            prev.map((it) => (it.key === key ? { ...it, result } : it)),
          );
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          setItems((prev) =>
            prev.map((it) => (it.key === key ? { ...it, error } : it)),
          );
        }
      }),
    );
    setTotalMs(performance.now() - started);
  }

  return (
    <main className={styles.main}>
      <h1>구조 확인</h1>

      <section>
        <h2>DB Worker (PGlite)</h2>
        {healthError && <p role="alert">실패: {healthError.message}</p>}
        {!health && !healthError && <p>PGlite 부팅 중…</p>}
        {health && (
          <ul>
            <li>{health.db.version}</li>
            <li>
              부팅 {Math.round(health.db.bootMs)}ms · 누적 부팅{" "}
              {health.db.bootCount}회 (새로고침하면 늘어나야 IndexedDB 유지)
            </li>
            <li>Render Worker {health.renderWorkers}개</li>
          </ul>
        )}
      </section>

      <section>
        <h2>데이터셋 (절차적 생성 → COPY 적재)</h2>
        <DatasetPanel rows={rows} onRowsChange={setRows} />
      </section>

      <section>
        <h2>Render Worker → Cache API → MSW → &lt;img&gt;</h2>
        <div className={styles.controls}>
          <label>
            item당 점 개수{" "}
            <input
              type="number"
              min={0}
              step={10_000}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </label>
          <button type="button" onClick={renderAll}>
            {ITEM_COUNT}개 동시 렌더
          </button>
          {totalMs !== undefined && <span>전체 {Math.round(totalMs)}ms</span>}
        </div>

        <div className={styles.grid}>
          {items.map((it) => (
            <figure key={it.key} className={styles.item}>
              <div
                className={styles.frame}
                style={{ width: WIDTH, height: HEIGHT }}
              >
                {it.error ? (
                  <span role="alert">{it.error}</span>
                ) : it.result ? (
                  <ChartImage data={it.result} alt={it.key} />
                ) : (
                  <span>렌더 중…</span>
                )}
              </div>
              {it.result && (
                <figcaption>
                  {it.result.worker} · {Math.round(it.result.renderMs)}ms
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
