"use client";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import { DatasetPanel } from "@/features/register-dataset/ui/DatasetPanel";
import { api } from "@/shared/api/api";
import { useHealth } from "@/shared/api/queries";
import type { DatasetId, DebugRenderResponse } from "@/shared/api/types";
import { DEFAULT_DATASET } from "@/shared/config/dataset";
import { button } from "@/shared/ui/button";
import "../config/messages";

const heading = "mb-2 font-bold text-base";

const ITEM_COUNT = 8;
/** 렌더 요청 크기. 아래 frame 칸(w-80 h-50) 크기와 같아야 한다. */
const WIDTH = 320;
const HEIGHT = 200;

type Item = { key: string; result?: DebugRenderResponse; error?: string };

/** 구조 검증 페이지: DB Worker 부팅, 데이터 생성, Render Worker 병렬 렌더, `<img>` → MSW → Cache API 경로. */
export function BootCheck() {
  const { t } = useLingui();
  const { data: health, error: healthError } = useHealth();
  const [dataset, setDataset] = useState<DatasetId>(DEFAULT_DATASET);
  const [items, setItems] = useState<Item[]>([]);
  const [points, setPoints] = useState(50_000);
  const [totalMs, setTotalMs] = useState<number>();

  const healthMessage = healthError?.message;
  const count = ITEM_COUNT;
  const bootLine = (bootMs: number, bootCount: number) =>
    t`부팅 ${bootMs}ms · 누적 부팅 ${bootCount}회 (새로고침하면 늘어나야 IndexedDB 유지)`;
  const workersLine = (workers: number) =>
    t`${plural(workers, { other: "Render Worker #개" })}`;
  const totalLine = (totalMs: number) => t`전체 ${totalMs}ms`;

  async function renderAll() {
    const keys = Array.from({ length: ITEM_COUNT }, (_, i) => `item-${i + 1}`);
    setItems(keys.map((key) => ({ key })));
    setTotalMs(undefined);
    const started = performance.now();

    await Promise.all(
      keys.map(async (key) => {
        try {
          const result = await api.debugRender({
            chartId: "boot-check",
            itemKey: key,
            width: WIDTH,
            height: HEIGHT,
            points,
          });
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
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-bold">
        <Trans>구조 확인</Trans>
      </h1>

      <section>
        <h2 className={heading}>DB Worker (PGlite)</h2>
        {healthError && (
          <p role="alert">
            <Trans>실패: {healthMessage}</Trans>
          </p>
        )}
        {!health && !healthError && (
          <p>
            <Trans>PGlite 부팅 중…</Trans>
          </p>
        )}
        {health && (
          <ul className="list-disc pl-5 leading-relaxed">
            <li>{health.db.version}</li>
            <li>
              {bootLine(Math.round(health.db.bootMs), health.db.bootCount)}
            </li>
            <li>{workersLine(health.renderWorkers)}</li>
          </ul>
        )}
      </section>

      <section>
        <h2 className={heading}>
          <Trans>데이터셋 (절차적 생성 → COPY 적재)</Trans>
        </h2>
        <DatasetPanel dataset={dataset} onChange={setDataset} showColumns />
      </section>

      <section>
        <h2 className={heading}>
          Render Worker → Cache API → MSW → &lt;img&gt;
        </h2>
        <div className="mb-3 flex items-center gap-3">
          <label>
            <Trans>item당 점 개수</Trans>{" "}
            <input
              type="number"
              className="w-24 rounded-sm border border-line bg-elevated px-1"
              min={0}
              step={10_000}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className={button({ size: "sm" })}
            onClick={renderAll}
          >
            {t`${count}개 동시 렌더`}
          </button>
          {totalMs !== undefined && (
            <span>{totalLine(Math.round(totalMs))}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {items.map((it) => (
            <figure key={it.key}>
              <div className="flex h-50 w-80 items-center justify-center border border-line text-ui text-fg-muted">
                {it.error ? (
                  <span role="alert">{it.error}</span>
                ) : it.result ? (
                  <ChartImage data={it.result} alt={it.key} />
                ) : (
                  <span>
                    <Trans>렌더 중…</Trans>
                  </span>
                )}
              </div>
              {it.result && (
                <figcaption className="mt-1 text-xs text-fg-muted">
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
