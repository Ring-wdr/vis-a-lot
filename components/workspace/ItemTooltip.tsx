"use client";

import { useMemo, useState } from "react";
import { ChartImage } from "@/components/ChartImage";
import { useItemMeta, useTooltipValues } from "@/lib/queries";
import { columnLabel, columnType, formatValue } from "@/lib/tooltip/format";
import { strategyFor } from "@/lib/tooltip/strategies";
import { useDebounced } from "@/lib/use-debounced";
import type { ChartImage as ChartImageData } from "@/server/api/types";
import type { ColumnName } from "@/server/data/schema";
import { ColorPickerButton } from "./ColorPickerButton";
import styles from "./Workspace.module.css";

type Cursor = { x: number; y: number };

const TOOLTIP_OFFSET = 14;
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
  const [hovered, setHovered] = useState(false);
  const [cursor, setCursor] = useState<Cursor>();
  const meta = useItemMeta(image.url, hovered);

  const strategy = meta.data ? strategyFor(meta.data) : undefined;
  const prepared = useMemo(
    () => (meta.data && strategy ? strategy.prepare(meta.data) : undefined),
    [meta.data, strategy],
  );

  const hit =
    cursor && meta.data && strategy
      ? strategy.hitTest(meta.data, prepared, cursor.x, cursor.y)
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
  const flip =
    screen && screen.x + TOOLTIP_OFFSET + TOOLTIP_WIDTH > display.width;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 마우스 위치를 읽는 시각 보조 레이어. 같은 정보는 이후 표 보기로 제공한다.
    <div
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
      {hit?.marker && (
        <span
          className={styles.hitMarker}
          style={{ left: hit.marker.px * sx, top: hit.marker.py * sy }}
        />
      )}
      {screen && hit && (
        <div
          role="tooltip"
          className={styles.tooltip}
          style={{
            top: Math.min(screen.y + TOOLTIP_OFFSET, display.height - 40),
            ...(flip
              ? { right: display.width - screen.x + TOOLTIP_OFFSET }
              : { left: screen.x + TOOLTIP_OFFSET }),
            width: TOOLTIP_WIDTH,
          }}
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
                  <dt>{columnLabel(c)}</dt>
                  <dd>
                    {extra.data && rowId === hit.rowId
                      ? formatValue(extra.data.values[c], columnType(c))
                      : "…"}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}
      {screen && hovered && meta.isPending && (
        <div
          className={styles.tooltip}
          style={{ left: screen.x + TOOLTIP_OFFSET, top: screen.y }}
        >
          불러오는 중…
        </div>
      )}
    </div>
  );
}
