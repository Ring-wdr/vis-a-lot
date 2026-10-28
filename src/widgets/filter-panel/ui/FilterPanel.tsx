"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown, Database } from "lucide-react";
import { useDatasetLabels } from "@/entities/dataset/lib/labels";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { filterOf, sameFilters } from "@/features/data-filter/model/filters";
import { ColumnFilter } from "@/features/data-filter/ui/ColumnFilter";
import { useDatasetSchema, useSchemaState } from "@/shared/api/queries";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    filters: "필터",
    clearAll: "모두 지우기",
    readOnly: "이 차트에 적용된 필터입니다.",
    pending: "바뀐 필터는 draw를 눌러야 적용됩니다.",
    idle: "필터는 draw할 때 적용됩니다.",
    noColumns: "컬럼 없음",
    generating: "데이터 등록이 끝나면 컬럼이 나타납니다.",
    missing: "데이터를 등록하면 컬럼이 나타납니다.",
    active: "필터 적용됨",
  },
  en: {
    filters: "Filters",
    clearAll: "Clear all",
    readOnly: "Filters applied to this chart.",
    pending: "Press draw to apply changed filters.",
    idle: "Filters apply when you draw.",
    noColumns: "No columns",
    generating: "Columns appear once the data is registered.",
    missing: "Columns appear after you register the data.",
    active: "Filter applied",
  },
});

const SKELETON_WIDTHS = [50, 70, 30, 50, 70, 30] as const;

/**
 * 오른쪽 필터 패널. 컬럼마다 아코디언 하나이고, 열기 전에는 컬럼 이름만 보여준다.
 * 아코디언을 여는 순간 그 컬럼의 범위나 값 목록을 서버에서 받는다(닫힌 패널은 마운트하지 않는다).
 * 필터는 draw할 때만 적용된다.
 */
export function FilterPanel() {
  const text = useT(messages);
  const labels = useDatasetLabels();
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
      className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-line bg-panel"
      aria-label={text.filters}
    >
      <header className="flex items-center gap-1.5 px-3.5 pt-3.5 pb-1 text-ui">
        <strong>{text.filters}</strong>
        {count > 0 && (
          <span className="inline-grid h-4.5 min-w-4.5 place-items-center rounded-full bg-accent px-1 text-2xs text-on-accent">
            {count}
          </span>
        )}
        {count > 0 && !readOnly && (
          <button
            type="button"
            className="ml-auto cursor-pointer text-xs text-accent"
            onClick={() => updateDraft({ filters: [] })}
          >
            {text.clearAll}
          </button>
        )}
      </header>
      <p
        className="px-3.5 pb-2.5 text-xs text-fg-muted data-pending:text-accent"
        data-pending={pending || undefined}
      >
        {readOnly ? text.readOnly : pending ? text.pending : text.idle}
      </p>
      {(schemaState === "missing" ||
        schemaState === "generating" ||
        schemaState === "deleted") && (
        <EmptyState
          size="sm"
          icon={<Database size={16} />}
          title={text.noColumns}
        >
          {schemaState === "generating"
            ? text.generating
            : schemaState === "deleted"
              ? labels.deletedDataset
              : text.missing}
        </EmptyState>
      )}
      {schemaState === "loading" && (
        // 컬럼 이름 자리를 잡아 둔다.
        <div
          className="min-h-0 flex-1 overflow-y-auto border-t border-line"
          aria-busy="true"
        >
          {SKELETON_WIDTHS.map((width, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: 받기 전 자리 표시용
              key={i}
              // 컬럼을 받는 동안의 자리: 아코디언 머리(h-8.5) + 아래 테두리와 같은 높이
              className="box-content flex h-8.5 items-center border-b border-line px-3.5"
            >
              <Skeleton width={width} />
            </div>
          ))}
        </div>
      )}
      {schemaState === "ready" && (
        <Accordion.Root
          multiple
          className="min-h-0 flex-1 overflow-y-auto border-t border-line"
        >
          {columns.map((c) => {
            const active = filterOf(filters, c.name) !== undefined;
            return (
              <Accordion.Item
                key={c.name}
                value={c.name}
                className="border-b border-line"
              >
                <Accordion.Header>
                  {/* 머리는 h3이라 브라우저 기본으로 굵었고, 버튼이 font: inherit로 그 굵기를 물려받았다. */}
                  <Accordion.Trigger className="group/trigger flex h-8.5 w-full cursor-pointer items-center gap-1.5 px-3.5 text-left text-ui font-bold text-fg hover:bg-panel-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                    <span className="min-w-0 flex-1 truncate">{c.label}</span>
                    <span className="text-2xs text-fg-muted">
                      {labels.columnTypes[c.type]}
                    </span>
                    {active && (
                      <>
                        <span
                          className="size-2 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                        <span className="sr-only">{text.active}</span>
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
