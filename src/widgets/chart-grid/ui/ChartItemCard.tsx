"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  useItemAction,
  useItemActionPending,
} from "@/features/item-actions/model/item-actions";
import { DrawLayer } from "@/features/item-actions/ui/DrawLayer";
import { ItemContextMenu } from "@/features/item-actions/ui/ItemContextMenu";
import { ItemToolbar } from "@/features/item-actions/ui/ItemToolbar";
import { LegendCheckboxes } from "@/features/item-actions/ui/LegendCheckboxes";
import { PaintToolbar } from "@/features/item-actions/ui/PaintToolbar";
import { ItemTooltip } from "@/features/item-tooltip/ui/ItemTooltip";
import { useJobItem } from "@/shared/api/queries";
import {
  type ChartImage,
  type ColumnName,
  type ItemSize,
  type ItemStage,
  type ItemState,
  isTerminal,
} from "@/shared/api/types";
import { showAlert } from "@/shared/ui/AlertDialog";
import { Spinner } from "@/shared/ui/Loading";
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
      <Spinner size="lg" />
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

/** 더블 클릭으로 크게 보기를 열고 닫는다. 버튼·입력·그리기 레이어 위에서는 그쪽 조작을 따른다. */
function doubleClickHandler(onDoubleClick: (() => void) | undefined) {
  if (!onDoubleClick) return undefined;
  return (e: React.MouseEvent) => {
    const target = e.target as Element;
    if (target.closest("button, input, [role='application']")) return;
    onDoubleClick();
  };
}

/** 크게 보기를 열거나(grid) grid로 돌아가는(크게 보기) 버튼 */
function ExpandButton({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick?: () => void;
}) {
  if (!onClick) return null;
  const label = expanded ? "grid로 돌아가기" : "크게 보기";
  return (
    <div className={styles.itemActions}>
      <button type="button" title={label} aria-label={label} onClick={onClick}>
        {expanded ? (
          <Minimize2 size={13} aria-hidden="true" />
        ) : (
          <Maximize2 size={13} aria-hidden="true" />
        )}
      </button>
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
  image = item.image,
  rendering,
  expanded = false,
  onDoubleClick,
}: {
  item: ItemState & { image: NonNullable<ItemState["image"]> };
  /** legend가 있으면 색은 legend 항목별로 바꾼다. */
  hasLegend: boolean;
  chartId: string;
  primaryJobId: string;
  tooltipColumns: ColumnName[];
  displaySize: ItemSize;
  /** 띄울 PNG. 크게 보기에서는 grid PNG 대신 그 크기로 그린 PNG를 준다. */
  image?: ChartImage;
  /** 크게 보기 PNG를 그리는 중이면 그 진행 상태 */
  rendering?: ItemState;
  /** 크게 보기 화면의 item인지 */
  expanded?: boolean;
  onDoubleClick?: () => void;
}) {
  const mode = useWorkspace((s) => s.mode);
  const paintTool = useWorkspace((s) => s.paintTool);
  const readOnly = useWorkspace((s) => s.readOnly);
  const commonPosition = useWorkspace(
    (s) => s.current?.spec.common.legendPosition ?? "top",
  );
  const itemJobId = useWorkspace((s) => s.itemJobs[item.key]);
  const undoCount = useWorkspace((s) => s.undoCounts[item.key] ?? 0);
  const setItemJob = useWorkspace((s) => s.setItemJob);
  const client = useQueryClient();
  const action = useItemAction(chartId, item.key);
  const itemJob = useJobItem(itemJobId, item.key);
  const redrawing = itemJob.data?.items[0];
  const pending = useItemActionPending(chartId, item.key);
  const busy = pending || itemJobId !== undefined;

  // 같은 job에 다른 item이 함께 있어도(resize) 이 item이 끝났는지로 판단한다.
  const jobStatus = redrawing?.status;
  const redrawnUrl = redrawing?.image?.url;
  const redrawError = redrawing?.error;
  useEffect(() => {
    if (!jobStatus || !isTerminal(jobStatus)) return;
    // draw job의 item 상태를 다시 받아 새 PNG로 바꾼다.
    client.invalidateQueries({ queryKey: ["jobs", primaryJobId] });
    if (jobStatus === "failed") {
      // 서버가 준 사유(지운 데이터 등)가 있으면 그대로 보여준다.
      showAlert(redrawError ?? "다시 그리기에 실패했습니다.");
      setItemJob(item.key, undefined);
    } else if (jobStatus !== "success" || item.image.url === redrawnUrl) {
      // 새 PNG가 grid에 반영된 뒤에 조작 차단을 푼다.
      setItemJob(item.key, undefined);
    }
  }, [
    jobStatus,
    redrawnUrl,
    redrawError,
    item.image.url,
    item.key,
    primaryJobId,
    client,
    setItemJob,
  ]);

  const checkboxes = (
    <LegendCheckboxes
      image={image}
      display={displaySize}
      alt={item.label}
      disabled={readOnly || busy}
      onAction={action.mutate}
    />
  );

  return (
    <article
      className={styles.item}
      aria-label={item.label}
      onDoubleClick={doubleClickHandler(onDoubleClick)}
    >
      {/* 우클릭 메뉴: 선택 영역을 즐겨찾기·새 범례로 남긴다. */}
      <ItemContextMenu
        item={item}
        disabled={readOnly || busy}
        className={styles.itemBody}
        onAction={action.mutate}
      >
        {mode === "normal" ? (
          <ItemTooltip
            image={image}
            alt={item.label}
            chartId={chartId}
            itemKey={item.key}
            columns={tooltipColumns}
            display={displaySize}
            overlay={checkboxes}
            onLegendColor={
              readOnly
                ? undefined
                : (value, color) =>
                    action.mutate({ type: "legendColor", value, color })
            }
          />
        ) : (
          <DrawLayer
            tool={mode === "paint" ? paintTool : mode}
            image={image}
            display={displaySize}
            alt={item.label}
            hasSelection={item.selectedCount !== undefined}
            overlay={checkboxes}
            onAction={action.mutate}
          />
        )}
        {busy ? (
          <div className={styles.busyOverlay} aria-busy="true">
            <Pending item={redrawing} placeholder="다시 그리는 중" />
          </div>
        ) : (
          rendering && (
            <div className={styles.busyOverlay} aria-busy="true">
              <Pending item={rendering} />
            </div>
          )
        )}
      </ItemContextMenu>
      {/* 페인트 모드에서만 차트 위 좌측 상단에 그리기 도구를 띄운다. 우측 도구처럼 커서를 올리면 보인다. */}
      {mode === "paint" && !readOnly && (
        <div className={styles.itemToolbar} data-side="left">
          <PaintToolbar
            item={item}
            busy={busy}
            undoCount={undoCount}
            onAction={action.mutate}
          />
        </div>
      )}
      {/* 차트 위 우측 상단에 떠 있는 도구. 커서를 올리거나 포커스가 들어오면 보인다. */}
      <div className={styles.itemToolbar}>
        {/* 다시 보기 전용 화면에서는 확대·도형·색을 바꾸지 않는다. */}
        {!readOnly && (
          <ItemToolbar
            item={item}
            busy={busy}
            hasLegend={hasLegend}
            commonPosition={commonPosition}
            onAction={action.mutate}
          />
        )}
        <ExpandButton expanded={expanded} onClick={onDoubleClick} />
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
  image,
  rendering,
  expanded = false,
  onDoubleClick,
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
  /** 띄울 PNG. 없으면 grid PNG를 띄운다. */
  image?: ChartImage;
  /** 크게 보기 PNG를 그리는 중이면 그 진행 상태 */
  rendering?: ItemState;
  /** 크게 보기 화면의 item인지 */
  expanded?: boolean;
  /** 더블 클릭이나 toolbar 버튼으로 크게 보기를 열고 닫는다. */
  onDoubleClick?: () => void;
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
        image={image}
        rendering={rendering}
        expanded={expanded}
        onDoubleClick={onDoubleClick}
      />
    );
  }
  return (
    <article
      className={styles.item}
      aria-label={item?.label}
      onDoubleClick={doubleClickHandler(onDoubleClick)}
    >
      <div className={styles.itemBody}>
        {/* 그림이 없으면 PNG 제목 대신 이름을 띄운다. */}
        <span className={styles.itemLabel} title={item?.label}>
          {item?.label ?? "…"}
        </span>
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
      <div className={styles.itemToolbar}>
        <ExpandButton expanded={expanded} onClick={onDoubleClick} />
      </div>
    </article>
  );
}
