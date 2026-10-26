"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChartOptionsPatch } from "@/entities/chart/model/chart-options";
import { ChartLegend } from "@/entities/chart/ui/ChartLegend";
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
import { useItemMeta, useJobItem } from "@/shared/api/queries";
import {
  type ChartImage,
  type ColumnName,
  type ItemSize,
  type ItemStage,
  type ItemState,
  isTerminal,
} from "@/shared/api/types";
import { defaultLegendPosition } from "@/shared/config/chart-kinds";
import { tv } from "@/shared/lib/tw";
import { showAlert } from "@/shared/ui/AlertDialog";
import { itemButton } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import { ItemSettingsDialog } from "./ItemSettingsDialog";

const STAGE_LABELS: Record<ItemStage, string> = {
  query: "데이터 조회",
  aggregate: "집계",
  render: "렌더링",
  encode: "PNG 변환",
};

// 누른 item(selected)은 다운로드·데이터 표의 대상이다. 크게 보기에서는 남은 자리를 채운다.
const itemCard =
  "group/item relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-line bg-surface data-selected:border-accent data-selected:ring-1 data-selected:ring-accent";
const itemBody = "relative flex min-h-0 flex-1 items-center justify-center";
const busyOverlay =
  "absolute inset-0 flex cursor-progress items-center justify-center bg-overlay";

/**
 * item 도구는 차트 위 모서리에 띄운다. 자리를 차지하지 않으니 PNG가 카드 전체를 쓴다.
 * 평소에는 숨기고, 커서를 올리거나 포커스가 들어오면 보인다.
 * 커서가 없는 기기에서는 늘 보인다.
 */
const itemToolbar = tv({
  base: "z-item-toolbar absolute top-1 flex items-center gap-0.5 rounded-md border border-line bg-elevated p-0.5 opacity-0 shadow-sm transition-opacity duration-120 group-hover/item:opacity-100 focus-within:opacity-100 hover-none:opacity-100",
  variants: { side: { left: "left-1", right: "right-1" } },
  defaultVariants: { side: "right" },
});

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
    <div className="flex w-[min(8.75rem,90%)] flex-col items-center gap-2 text-center text-xs text-fg-muted">
      <Spinner size="lg" />
      <span>{label}</span>
      {/* 대기 → 렌더링으로 넘어갈 때 줄이 생기며 밀리지 않도록 진행 막대 자리는 늘 둔다. */}
      <progress
        className="w-full"
        value={item?.status === "running" ? item.stageProgress : 0}
        max={1}
        aria-hidden={item?.status !== "running"}
      />
    </div>
  );
}

/**
 * 누른 item(selected)에서만 PNG legend 자리에 같은 legend를 DOM으로 겹쳐 그린다.
 * 위치·모양은 서버 metadata에서 읽고, 받기 전이나 legend가 없으면 PNG legend만 보인다.
 */
function SelectedLegend({
  image,
  display,
  selected,
}: {
  image: ChartImage;
  display: { width: number; height: number };
  selected: boolean;
}) {
  const meta = useItemMeta(image.url, selected);
  const legend = meta.data?.legend;
  if (!selected || !legend) return null;
  return <ChartLegend legend={legend} image={image} display={display} />;
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
    <div className="flex gap-0.5">
      <button
        type="button"
        className={itemButton()}
        title={label}
        aria-label={label}
        onClick={onClick}
      >
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
  // item 속성 팝업. 열린 동안만 그려 열 때마다 지금 item 값에서 시작한다.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const commonPosition = useWorkspace(
    (s) =>
      s.current?.spec.common.legendPosition ??
      defaultLegendPosition(s.current?.spec.chartType),
  );
  const itemJobId = useWorkspace((s) => s.itemJobs[item.key]);
  const selected = useWorkspace((s) => s.selectedItem === item.key);
  const setSelectedItem = useWorkspace((s) => s.setSelectedItem);
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

  // PNG 위에 겹치는 층: DOM legend 위에 legend 체크박스를 둔다.
  const overlay = (
    <>
      <SelectedLegend image={image} display={displaySize} selected={selected} />
      <LegendCheckboxes
        image={image}
        display={displaySize}
        alt={item.label}
        disabled={readOnly || busy}
        onAction={action.mutate}
      />
    </>
  );

  return (
    <article
      className={itemCard}
      aria-label={item.label}
      data-selected={selected || undefined}
      onPointerDownCapture={() => setSelectedItem(item.key)}
      onFocusCapture={() => setSelectedItem(item.key)}
      onDoubleClick={doubleClickHandler(onDoubleClick)}
    >
      {/* 우클릭 메뉴: 선택 영역을 즐겨찾기·새 범례로 남긴다. */}
      <ItemContextMenu
        item={item}
        disabled={readOnly || busy}
        className={itemBody}
        onAction={action.mutate}
      >
        {mode === "normal" ? (
          <ItemTooltip
            image={image}
            alt={item.label}
            chartId={chartId}
            itemKey={item.key}
            columns={tooltipColumns}
            itemOptions={item.options as ChartOptionsPatch | undefined}
            display={displaySize}
            overlay={overlay}
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
            overlay={overlay}
            onAction={action.mutate}
          />
        )}
        {busy ? (
          <div className={busyOverlay} aria-busy="true">
            <Pending item={redrawing} placeholder="다시 그리는 중" />
          </div>
        ) : (
          rendering && (
            <div className={busyOverlay} aria-busy="true">
              <Pending item={rendering} />
            </div>
          )
        )}
      </ItemContextMenu>
      {/* 페인트 모드에서만 차트 위 좌측 상단에 그리기 도구를 띄운다. 우측 도구처럼 커서를 올리면 보인다. */}
      {mode === "paint" && !readOnly && (
        <div className={itemToolbar({ side: "left" })}>
          <PaintToolbar
            item={item}
            busy={busy}
            undoCount={undoCount}
            onAction={action.mutate}
          />
        </div>
      )}
      {/* 차트 위 우측 상단에 떠 있는 도구. 커서를 올리거나 포커스가 들어오면 보인다. */}
      <div className={itemToolbar()}>
        {/* 다시 보기 전용 화면에서는 확대·도형·색을 바꾸지 않는다. */}
        {!readOnly && (
          <ItemToolbar
            item={item}
            busy={busy}
            onOpenSettings={() => setSettingsOpen(true)}
            onAction={action.mutate}
          />
        )}
        <ExpandButton expanded={expanded} onClick={onDoubleClick} />
      </div>
      {settingsOpen && (
        <ItemSettingsDialog
          item={item}
          hasLegend={hasLegend}
          commonPosition={commonPosition}
          onAction={action.mutate}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
      className={itemCard}
      aria-label={item?.label}
      onDoubleClick={doubleClickHandler(onDoubleClick)}
    >
      <div className={itemBody}>
        {/* 그림이 없으면 PNG 제목 대신 이름을 띄운다. */}
        <span
          className="absolute top-2 left-2.5 max-w-[calc(100%-3.75rem)] truncate text-xs font-semibold"
          title={item?.label}
        >
          {item?.label ?? "…"}
        </span>
        {item?.status === "failed" ? (
          <p role="alert" className="text-xs text-danger">
            렌더 실패: {item.error}
          </p>
        ) : item?.status === "cancelled" ? (
          <p className="text-xs text-fg-muted">취소됨</p>
        ) : (
          <Pending item={item} placeholder={placeholder} />
        )}
      </div>
      <div className={itemToolbar()}>
        <ExpandButton expanded={expanded} onClick={onDoubleClick} />
      </div>
    </article>
  );
}
