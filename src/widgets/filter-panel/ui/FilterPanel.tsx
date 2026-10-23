"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown, Database } from "lucide-react";
import {
  COLUMN_TYPE_LABELS,
  DELETED_DATASET_HINT,
} from "@/entities/dataset/lib/labels";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { filterOf, sameFilters } from "@/features/data-filter/model/filters";
import { ColumnFilter } from "@/features/data-filter/ui/ColumnFilter";
import { useDatasetSchema, useSchemaState } from "@/shared/api/queries";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";

const SKELETON_WIDTHS = [50, 70, 30, 50, 70, 30] as const;

/**
 * 오른쪽 필터 패널. 컬럼마다 아코디언 하나이고, 열기 전에는 컬럼 이름만 보여준다.
 * 아코디언을 여는 순간 그 컬럼의 범위나 값 목록을 서버에서 받는다(닫힌 패널은 마운트하지 않는다).
 * 필터는 draw할 때만 적용된다.
 */
export function FilterPanel() {
  const filters = useWorkspace((s) => s.draft.filters);
  const applied = useWorkspace((s) => s.current?.spec.filters);
  const drawn = useWorkspace((s) => s.current !== undefined);
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const dataset = useWorkspace((s) => s.draft.dataset);
  // 컬럼은 데이터마다 달라 고른 데이터셋의 스키마에서 받는다.
  const schema = useDatasetSchema(dataset);
  const columns = schema.data?.columns ?? [];
  const schemaState = useSchemaState(dataset);
  const count = filters?.length ?? 0;
  const pending = drawn && !readOnly && !sameFilters(filters, applied);

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col border-line border-l bg-panel"
      aria-label="필터"
    >
      <header className="flex items-center gap-1.5 px-3.5 pt-3.5 pb-1 text-13">
        <strong>필터</strong>
        {count > 0 && (
          <span className="inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1.25 text-11 text-on-accent">
            {count}
          </span>
        )}
        {count > 0 && !readOnly && (
          <button
            type="button"
            className="ml-auto cursor-pointer text-12 text-accent"
            onClick={() => updateDraft({ filters: [] })}
          >
            모두 지우기
          </button>
        )}
      </header>
      <p
        className="px-3.5 pb-2.5 text-12 text-fg-muted data-pending:text-accent"
        data-pending={pending || undefined}
      >
        {readOnly
          ? "이 차트에 적용된 필터입니다."
          : pending
            ? "바뀐 필터는 draw를 눌러야 적용됩니다."
            : "필터는 draw할 때 적용됩니다."}
      </p>
      {(schemaState === "missing" ||
        schemaState === "generating" ||
        schemaState === "deleted") && (
        <EmptyState size="sm" icon={<Database size={16} />} title="컬럼 없음">
          {schemaState === "generating"
            ? "데이터 등록이 끝나면 컬럼이 나타납니다."
            : schemaState === "deleted"
              ? DELETED_DATASET_HINT
              : "데이터를 등록하면 컬럼이 나타납니다."}
        </EmptyState>
      )}
      {schemaState === "loading" && (
        // 컬럼 이름 자리를 잡아 둔다.
        <div
          className="min-h-0 flex-1 overflow-y-auto border-line border-t"
          aria-busy="true"
        >
          {SKELETON_WIDTHS.map((width, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: 받기 전 자리 표시용
              key={i}
              // 컬럼을 받는 동안의 자리: 아코디언 머리와 같은 높이
              className="flex h-9.25 items-center border-line border-b px-3.5"
            >
              <Skeleton width={width} />
            </div>
          ))}
        </div>
      )}
      {schemaState === "ready" && (
        <Accordion.Root
          multiple
          className="min-h-0 flex-1 overflow-y-auto border-line border-t"
        >
          {columns.map((c) => {
            const active = filterOf(filters, c.name) !== undefined;
            return (
              <Accordion.Item
                key={c.name}
                value={c.name}
                className="border-line border-b"
              >
                <Accordion.Header>
                  {/* 머리는 h3이라 브라우저 기본으로 굵었고, 버튼이 font: inherit로 그 굵기를 물려받았다. */}
                  <Accordion.Trigger className="group/trigger flex w-full cursor-pointer items-center gap-1.5 px-3.5 py-2.25 text-left font-bold text-13 text-fg hover:bg-panel-4 focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2">
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="text-11 text-fg-muted">
                      {COLUMN_TYPE_LABELS[c.type]}
                    </span>
                    {active && (
                      <>
                        <span
                          className="size-1.75 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span className="sr-only">필터 적용됨</span>
                      </>
                    )}
                    <ChevronDown
                      size={14}
                      className="flex-none text-fg-muted transition-transform duration-150 ease-[ease] group-data-panel-open/trigger:rotate-180"
                      aria-hidden="true"
                    />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className="px-3.5 pt-0.5 pb-3.5">
                  <ColumnFilter column={c.name} />
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion.Root>
      )}
    </section>
  );
}
