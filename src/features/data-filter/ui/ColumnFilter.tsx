"use client";

import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useColumnSummary } from "@/shared/api/queries";
import type { ColumnName } from "@/shared/api/types";
import { LoadingText } from "@/shared/ui/Loading";
import { filterOf, withFilter } from "../model/filters";
import { RangeFilterBody } from "./RangeFilterBody";
import { ValuesFilterBody } from "./ValuesFilterBody";

/**
 * 컬럼 하나의 필터. 아코디언을 열 때 처음 마운트되며, 그때 서버에서 컬럼 요약을 받는다(받는 동안 pending).
 * 바꾼 필터는 draft에만 담기고 draw할 때 적용된다.
 */
export function ColumnFilter({ column }: { column: ColumnName }) {
  const dataset = useWorkspace((s) => s.draft.dataset);
  const filters = useWorkspace((s) => s.draft.filters);
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const summary = useColumnSummary(dataset, column);
  const filter = filterOf(filters, column);

  if (summary.isPending) {
    return (
      <div
        className="flex items-center gap-2 text-xs text-fg-muted"
        aria-busy="true"
      >
        <LoadingText>값 범위를 불러오는 중</LoadingText>
      </div>
    );
  }
  if (summary.error) {
    return (
      <p role="alert" className="text-xs text-danger">
        {summary.error.message === "dataset is not ready"
          ? "데이터가 준비되면 필터를 쓸 수 있습니다."
          : summary.error.message}
      </p>
    );
  }
  const change = (next: Parameters<typeof withFilter>[2]) =>
    updateDraft({ filters: withFilter(filters, column, next) });

  return summary.data.kind === "range" ? (
    <RangeFilterBody
      summary={summary.data}
      filter={filter?.kind === "range" ? filter : undefined}
      disabled={readOnly}
      onChange={change}
    />
  ) : (
    <ValuesFilterBody
      summary={summary.data}
      filter={filter?.kind === "exclude" ? filter : undefined}
      disabled={readOnly}
      onChange={change}
    />
  );
}
