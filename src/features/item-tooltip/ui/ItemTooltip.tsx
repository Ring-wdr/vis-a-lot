"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChartOptionsPatch } from "@/entities/chart/model/chart-options";
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { strategyFor } from "@/features/item-tooltip/lib/strategies";
import { ApiRequestError } from "@/shared/api/api";
import {
  useColumns,
  useItemMeta,
  useTooltipValues,
} from "@/shared/api/queries";
import type {
  ChartImage as ChartImageData,
  ColumnName,
} from "@/shared/api/types";
import { formatValue } from "@/shared/lib/format";
import { useDebounced } from "@/shared/lib/use-debounced";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import { LoadingText, Skeleton } from "@/shared/ui/Loading";
import styles from "@/shared/ui/workspace.module.css";
import {
  formatTooltipText,
  resolveTooltipOptions,
  tooltipBoxStyle,
} from "./tooltip-options";

type Cursor = { x: number; y: number };

const TOOLTIP_OFFSET = 14;
/** 화면 밖으로 나가지 않게 위치를 정할 때 쓰는 툴팁 폭. CSS의 .tooltipPortal 폭과 같아야 한다. */
const TOOLTIP_WIDTH = 200;

/**
 * PNG 위의 툴팁 레이어. 처음 커서를 올리면 metadata를 받아 오고,
 * 그 뒤로는 metadata만으로 커서 좌표값과 가장 가까운 점을 바로 계산한다.
 */
export function ItemTooltip({
  image,
  alt,
  chartId,
  itemKey,
  columns,
  display,
  onLegendColor,
  overlay,
  itemOptions,
}: {
  /** item에 따로 정한 차트 속성. 툴팁 모양(tooltip 구역)을 공통 속성 위에 덮는다. */
  itemOptions?: ChartOptionsPatch;
  /** PNG 위에 겹칠 조작 (legend 체크박스) */
  overlay?: ReactNode;
  image: ChartImageData;
  /** PNG 안 legend 상자의 [● 값]을 눌러 고른 최종 색 */
  onLegendColor?: (value: string, color: string) => void;
  /** 화면에 보이는 크기. resize 대기 중에는 PNG 크기와 다를 수 있다. */
  display: { width: number; height: number };
  alt: string;
  chartId: string;
  itemKey: string;
  /** x, y 외에 툴팁에 보여줄 컬럼 (서버 조회) */
  columns: ColumnName[];
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [cursor, setCursor] = useState<Cursor>();
  const meta = useItemMeta(image.url, hovered);
  // 컬럼 라벨·타입은 그린 차트의 데이터셋 스키마에서 찾는다.
  const dataset = useWorkspace(
    (s) => s.current?.spec.dataset ?? s.draft.dataset,
  );
  const columnInfo = useColumns(dataset);
  const showNearest = useWorkspace((s) => s.showNearest);
  const spec = useWorkspace((s) => s.current?.spec);
  const look = resolveTooltipOptions(
    spec?.chartType,
    spec?.common.options as ChartOptionsPatch | undefined,
    itemOptions,
  );
  const text = (value: string) =>
    look ? formatTooltipText(value, look) : value;
  // 정한 글자 색은 줄 이름(dt)과 값(dd)에 모두 입힌다 (기본은 테마의 보조 글자 색).
  const rowStyle = look && { color: look.fontColor };

  const strategy = meta.data ? strategyFor(meta.data) : undefined;
  const prepared = useMemo(
    () => (meta.data && strategy ? strategy.prepare(meta.data) : undefined),
    [meta.data, strategy],
  );

  const hit =
    cursor && meta.data && strategy
      ? strategy.hitTest(meta.data, prepared, cursor.x, cursor.y, {
          nearest: showNearest,
        })
      : null;
  const rowId = useDebounced(hit?.rowId, 100);
  const extra = useTooltipValues(chartId, itemKey, rowId, columns);
  const extraFailure =
    extra.error instanceof ApiRequestError && extra.error.status === 404
      ? "삭제된 데이터라 값을 읽을 수 없습니다"
      : "값을 읽지 못했습니다";

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // 커서가 이미 올라가 있을 때 레이어가 새로 생겨도(크게 보기, 모드 전환) 받아 오도록 여기서도 켠다.
    setHovered(true);
    // 실패한 채 남은 metadata는 커서를 움직이면 다시 받는다 (그사이 서버가 다시 그렸을 수 있다).
    if (meta.isError && !meta.isFetching) meta.refetch();
    const rect = e.currentTarget.getBoundingClientRect();
    // 이미지가 늘어나 보일 때(resize 대기 중)도 PNG 좌표로 바꿔 계산한다.
    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;
    setCursor({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  };

  // 계산은 PNG 좌표로 하고, 화면에 놓을 때만 보이는 크기로 환산한다.
  const sx = display.width / image.width;
  const sy = display.height / image.height;
  const screen = cursor && { x: cursor.x * sx, y: cursor.y * sy };
  // 툴팁은 item 카드의 overflow에 잘리지 않도록 body에 portal로 띄우고 화면 좌표로 놓는다.
  const layerRect = layerRef.current?.getBoundingClientRect();
  const client = screen &&
    layerRect && { x: layerRect.left + screen.x, y: layerRect.top + screen.y };
  const extraRows = hit?.rowId !== undefined ? columns.length : 0;
  const tooltipPosition =
    client && placeTooltip(client, (hit?.rows.length ?? 1) + extraRows);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 마우스 위치를 읽는 시각 보조 레이어. 같은 정보는 이후 표 보기로 제공한다.
    <div
      ref={layerRef}
      className={styles.tooltipLayer}
      style={{ width: display.width, height: display.height }}
      // 다시 그리는 동안 덮였던 레이어가 커서 아래에서 다시 드러나면 mousemove 없이 enter만 온다.
      onMouseEnter={onMove}
      onMouseMove={onMove}
      onMouseLeave={() => setCursor(undefined)}
    >
      <ChartImage data={image} alt={alt} />
      {overlay}
      {meta.data?.legend && onLegendColor && (
        // PNG에 그려진 legend 항목 자리에 색 선택 버튼을 겹친다 (위치는 metadata).
        <div className={styles.legendHitLayer}>
          {meta.data.legend.entries.map((entry) => (
            <ColorPickerButton
              key={entry.value}
              className={styles.legendHit}
              style={{
                left: entry.rect.x * sx,
                top: entry.rect.y * sy,
                width: entry.rect.width * sx,
                height: entry.rect.height * sy,
              }}
              color={entry.color}
              label={`${alt} · ${entry.value} 색 바꾸기`}
              onCommit={(color) => onLegendColor(entry.value, color)}
            />
          ))}
        </div>
      )}
      {cursor && hit?.marker && (
        <span
          className={styles.hitMarker}
          style={{ left: hit.marker.px * sx, top: hit.marker.py * sy }}
        />
      )}
      {cursor && hit?.highlight && (
        // bar/boxplot: 가리킨 막대/상자를 감싸는 사각형
        <span
          className={styles.hitBox}
          style={{
            left: hit.highlight.x * sx,
            top: hit.highlight.y * sy,
            width: hit.highlight.width * sx,
            height: hit.highlight.height * sy,
          }}
        />
      )}
      {cursor && hit?.outline && (
        // sankey: 가리킨 흐름 띠. PNG 좌표 path를 보이는 크기로 늘려 겹친다.
        <svg
          className={styles.hitOutline}
          viewBox={`0 0 ${image.width} ${image.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d={hit.outline} />
        </svg>
      )}
      {tooltipPosition &&
        hit &&
        createPortal(
          <div
            role="tooltip"
            className={`${styles.tooltip} ${styles.tooltipPortal}`}
            style={
              look
                ? { ...tooltipBoxStyle(look), ...tooltipPosition }
                : tooltipPosition
            }
          >
            {look?.title && <strong>{look.title}</strong>}
            <dl>
              {hit.rows.map((row) => (
                <div
                  key={row.label}
                  className={row.emphasis ? styles.emphasis : undefined}
                >
                  <dt style={rowStyle}>{row.label}</dt>
                  <dd style={rowStyle}>{text(row.value)}</dd>
                </div>
              ))}
              {hit.rowId !== undefined &&
                columns.map((c) => (
                  <div key={c} className={styles.emphasis}>
                    <dt style={rowStyle}>{columnInfo.label(c)}</dt>
                    <dd style={rowStyle}>
                      {extra.data && rowId === hit.rowId ? (
                        text(
                          formatValue(extra.data.values[c], columnInfo.type(c)),
                        )
                      ) : extra.isError ? (
                        // 받지 못했으면 자리 표시를 계속 두지 않고 사유를 남긴다.
                        <span className={styles.muted} title={extraFailure}>
                          –
                        </span>
                      ) : (
                        <Skeleton className={styles.tooltipValueSkeleton} />
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>,
          document.body,
        )}
      {tooltipPosition &&
        hovered &&
        !meta.data &&
        (meta.isPending || meta.isFetching) &&
        createPortal(
          <div
            className={`${styles.tooltip} ${styles.tooltipPortal}`}
            style={tooltipPosition}
          >
            <LoadingText>불러오는 중</LoadingText>
          </div>,
          document.body,
        )}
    </div>
  );
}

const ROW_HEIGHT = 18;
const TOOLTIP_PADDING = 20;
const VIEWPORT_MARGIN = 8;

/** 커서 오른쪽 아래에 두고, 화면 오른쪽/아래 끝을 넘으면 반대쪽으로 뒤집는다. */
function placeTooltip(client: { x: number; y: number }, rowCount: number) {
  const height = rowCount * ROW_HEIGHT + TOOLTIP_PADDING;
  const left =
    client.x + TOOLTIP_OFFSET + TOOLTIP_WIDTH >
    window.innerWidth - VIEWPORT_MARGIN
      ? client.x - TOOLTIP_OFFSET - TOOLTIP_WIDTH
      : client.x + TOOLTIP_OFFSET;
  const top =
    client.y + TOOLTIP_OFFSET + height > window.innerHeight - VIEWPORT_MARGIN
      ? client.y - TOOLTIP_OFFSET - height
      : client.y + TOOLTIP_OFFSET;
  return {
    left: Math.max(VIEWPORT_MARGIN, left),
    top: Math.max(VIEWPORT_MARGIN, top),
  };
}
