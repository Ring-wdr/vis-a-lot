"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useItemAction } from "@/features/item-actions/model/item-actions";
import { DrawLayer } from "@/features/item-actions/ui/DrawLayer";
import { ItemToolbar } from "@/features/item-actions/ui/ItemToolbar";
import { ItemTooltip } from "@/features/item-tooltip/ui/ItemTooltip";
import { useJobItem } from "@/shared/api/queries";
import {
  type ColumnName,
  type ItemSize,
  type ItemStage,
  type ItemState,
  isTerminal,
} from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import styles from "@/shared/ui/workspace.module.css";

const STAGE_LABELS: Record<ItemStage, string> = {
  query: "데이터 조회",
  aggregate: "집계",
  render: "렌더링",
  encode: "PNG 변환",
};

function Pending({
  item,
  placeholder,
}: {
  item?: ItemState;
  placeholder?: string;
}) {
  const stage = item?.stage;
  const label =
    item?.status === "queued"
      ? "대기 중"
      : stage
        ? STAGE_LABELS[stage]
        : (placeholder ?? "준비 중");
  return (
    <div className={styles.pending}>
      <span className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
      {/* 대기 → 렌더링으로 넘어갈 때 줄이 생기며 밀리지 않도록 진행 막대 자리는 늘 둔다. */}
      <progress
        value={item?.status === "running" ? item.stageProgress : 0}
        max={1}
        aria-hidden={item?.status !== "running"}
      />
    </div>
  );
}

/**
 * 다 그려진 item. 모드에 따라 툴팁 또는 확대/도형 레이어를 띄우고,
 * item 단위로 다시 그리는 동안에는 기존 PNG 위에 진행률을 덮어 조작을 막는다.
 */
function DrawnItem({
  item,
  chartId,
  primaryJobId,
  tooltipColumns,
  displaySize,
  hasLegend,
}: {
  item: ItemState & { image: NonNullable<ItemState["image"]> };
  /** legend가 있으면 색은 legend 항목별로 바꾼다. */
  hasLegend: boolean;
  chartId: string;
  primaryJobId: string;
  tooltipColumns: ColumnName[];
  displaySize: ItemSize;
}) {
  const mode = useWorkspace((s) => s.mode);
  const readOnly = useWorkspace((s) => s.readOnly);
  const itemJobId = useWorkspace((s) => s.itemJobs[item.key]);
  const undoCount = useWorkspace((s) => s.undoCounts[item.key] ?? 0);
  const setItemJob = useWorkspace((s) => s.setItemJob);
  const client = useQueryClient();
  const action = useItemAction(chartId, item.key);
  const itemJob = useJobItem(itemJobId, item.key);
  const redrawing = itemJob.data?.items[0];
  const busy = action.isPending || itemJobId !== undefined;

  // 같은 job에 다른 item이 함께 있어도(resize) 이 item이 끝났는지로 판단한다.
  const jobStatus = redrawing?.status;
  const redrawnUrl = redrawing?.image?.url;
  useEffect(() => {
    if (!jobStatus || !isTerminal(jobStatus)) return;
    // draw job의 item 상태를 다시 받아 새 PNG로 바꾼다.
    client.invalidateQueries({ queryKey: ["jobs", primaryJobId] });
    if (jobStatus === "failed") {
      showAlert("다시 그리기에 실패했습니다.");
      setItemJob(item.key, undefined);
    } else if (jobStatus !== "success" || item.image.url === redrawnUrl) {
      // 새 PNG가 grid에 반영된 뒤에 조작 차단을 푼다.
      setItemJob(item.key, undefined);
    }
  }, [
    jobStatus,
    redrawnUrl,
    item.image.url,
    item.key,
    primaryJobId,
    client,
    setItemJob,
  ]);

  return (
    <article className={styles.item}>
      <div className={styles.itemToolbar}>
        <span className={styles.itemLabel} title={item.label}>
          {item.label}
        </span>
        {/* 다시 보기 전용 화면에서는 확대·도형·색을 바꾸지 않는다. */}
        {!readOnly && (
          <ItemToolbar
            item={item}
            busy={busy}
            undoCount={undoCount}
            hasLegend={hasLegend}
            onAction={action.mutate}
          />
        )}
      </div>
      <div className={styles.itemBody}>
        {mode === "normal" ? (
          <ItemTooltip
            image={item.image}
            alt={item.label}
            chartId={chartId}
            itemKey={item.key}
            columns={tooltipColumns}
            display={displaySize}
            onLegendColor={
              readOnly
                ? undefined
                : (value, color) =>
                    action.mutate({ type: "legendColor", value, color })
            }
          />
        ) : (
          <DrawLayer
            mode={mode}
            image={item.image}
            display={displaySize}
            alt={item.label}
            onAction={action.mutate}
          />
        )}
        {busy && (
          <div className={styles.busyOverlay} aria-busy="true">
            <Pending item={redrawing} placeholder="다시 그리는 중" />
          </div>
        )}
      </div>
    </article>
  );
}

/** item 하나. PNG가 있어야만 이미지를 띄우고, 없으면 spinner + progress bar를 보여준다. */
export function ChartItemCard({
  item,
  placeholder,
  chartId,
  primaryJobId,
  tooltipColumns = [],
  displaySize,
  hasLegend = false,
}: {
  item?: ItemState;
  hasLegend?: boolean;
  chartId?: string;
  primaryJobId?: string;
  /** 칸 크기. 없으면 PNG 원래 크기로 보여준다. */
  displaySize?: ItemSize;
  tooltipColumns?: ColumnName[];
  /** item 목록이 정해지기 전 자리 표시 문구 */
  placeholder?: string;
}) {
  if (item?.status === "success" && item.image && chartId && primaryJobId) {
    return (
      <DrawnItem
        item={{ ...item, image: item.image }}
        chartId={chartId}
        primaryJobId={primaryJobId}
        tooltipColumns={tooltipColumns}
        displaySize={displaySize ?? item.image}
        hasLegend={hasLegend}
      />
    );
  }
  return (
    <article className={styles.item}>
      <div className={styles.itemToolbar}>
        <span className={styles.itemLabel} title={item?.label}>
          {item?.label ?? "…"}
        </span>
      </div>
      <div className={styles.itemBody}>
        {item?.status === "failed" ? (
          <p role="alert" className={styles.error}>
            렌더 실패: {item.error}
          </p>
        ) : item?.status === "cancelled" ? (
          <p className={styles.muted}>취소됨</p>
        ) : (
          <Pending item={item} placeholder={placeholder} />
        )}
      </div>
    </article>
  );
}
