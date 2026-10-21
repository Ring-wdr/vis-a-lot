"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChartImage } from "@/entities/chart/ui/ChartImage";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { strategyFor } from "@/features/item-tooltip/lib/strategies";
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
import styles from "@/shared/ui/workspace.module.css";

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
}: {
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
  const rows = useWorkspace((s) => s.current?.spec.rows ?? s.draft.rows);
  const columnInfo = useColumns(rows);
  const showNearest = useWorkspace((s) => s.showNearest);

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

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
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
      onMouseEnter={() => setHovered(true)}
      onMouseMove={onMove}
      onMouseLeave={() => setCursor(undefined)}
    >
      <ChartImage data={image} alt={alt} />
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
      {tooltipPosition &&
        hit &&
        createPortal(
          <div
            role="tooltip"
            className={`${styles.tooltip} ${styles.tooltipPortal}`}
            style={tooltipPosition}
          >
            <dl>
              {hit.rows.map((row) => (
                <div
                  key={row.label}
                  className={row.emphasis ? styles.emphasis : undefined}
                >
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              {hit.rowId !== undefined &&
                columns.map((c) => (
                  <div key={c} className={styles.emphasis}>
                    <dt>{columnInfo.label(c)}</dt>
                    <dd>
                      {extra.data && rowId === hit.rowId
                        ? formatValue(extra.data.values[c], columnInfo.type(c))
                        : "…"}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>,
          document.body,
        )}
      {tooltipPosition &&
        hovered &&
        meta.isPending &&
        createPortal(
          <div
            className={`${styles.tooltip} ${styles.tooltipPortal}`}
            style={tooltipPosition}
          >
            불러오는 중…
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
