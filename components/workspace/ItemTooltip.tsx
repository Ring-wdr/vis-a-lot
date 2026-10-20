"use client";

import { useMemo, useState } from "react";
import { ChartImage } from "@/components/ChartImage";
import { useItemMeta, useTooltipValues } from "@/lib/queries";
import { columnLabel, columnType, formatValue } from "@/lib/tooltip/format";
import { strategyFor } from "@/lib/tooltip/strategies";
import { useDebounced } from "@/lib/use-debounced";
import type { ChartImage as ChartImageData } from "@/server/api/types";
import type { ColumnName } from "@/server/data/schema";
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
}: {
  image: ChartImageData;
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

  const flip =
    cursor && cursor.x + TOOLTIP_OFFSET + TOOLTIP_WIDTH > image.width;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 마우스 위치를 읽는 시각 보조 레이어. 같은 정보는 이후 표 보기로 제공한다.
    <div
      className={styles.tooltipLayer}
      style={{ width: image.width, height: image.height }}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={onMove}
      onMouseLeave={() => setCursor(undefined)}
    >
      <ChartImage data={image} alt={alt} />
      {hit?.marker && (
        <span
          className={styles.hitMarker}
          style={{ left: hit.marker.px, top: hit.marker.py }}
        />
      )}
      {cursor && hit && (
        <div
          role="tooltip"
          className={styles.tooltip}
          style={{
            top: Math.min(cursor.y + TOOLTIP_OFFSET, image.height - 40),
            ...(flip
              ? { right: image.width - cursor.x + TOOLTIP_OFFSET }
              : { left: cursor.x + TOOLTIP_OFFSET }),
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
      {cursor && hovered && meta.isPending && (
        <div
          className={styles.tooltip}
          style={{ left: cursor.x + TOOLTIP_OFFSET, top: cursor.y }}
        >
          불러오는 중…
        </div>
      )}
    </div>
  );
}
