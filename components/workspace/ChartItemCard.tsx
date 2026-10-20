"use client";

import { ChartImage } from "@/components/ChartImage";
import { ITEM_TOOLBAR_HEIGHT } from "@/lib/grid-layout";
import type { ItemStage, ItemState } from "@/server/api/types";
import styles from "./Workspace.module.css";

const STAGE_LABELS: Record<ItemStage, string> = {
  query: "데이터 조회",
  aggregate: "집계",
  render: "렌더링",
  encode: "PNG 변환",
};

function Pending({ item }: { item?: ItemState }) {
  const stage = item?.stage;
  const label =
    item?.status === "queued"
      ? "대기 중"
      : stage
        ? STAGE_LABELS[stage]
        : "준비 중";
  return (
    <div className={styles.pending}>
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
      {item?.status === "running" && (
        <progress value={item.stageProgress} max={1} />
      )}
    </div>
  );
}

/** item 하나. PNG가 있어야만 이미지를 띄우고, 없으면 spinner + progress bar를 보여준다. */
export function ChartItemCard({ item }: { item?: ItemState }) {
  return (
    <article className={styles.item}>
      <div
        className={styles.itemToolbar}
        style={{ height: ITEM_TOOLBAR_HEIGHT }}
      >
        <span className={styles.itemLabel} title={item?.label}>
          {item?.label ?? "…"}
        </span>
      </div>
      <div className={styles.itemBody}>
        {item?.status === "success" && item.image ? (
          <ChartImage data={item.image} alt={item.label} />
        ) : item?.status === "failed" ? (
          <p role="alert" className={styles.error}>
            렌더 실패: {item.error}
          </p>
        ) : item?.status === "cancelled" ? (
          <p className={styles.muted}>취소됨</p>
        ) : (
          <Pending item={item} />
        )}
      </div>
    </article>
  );
}
