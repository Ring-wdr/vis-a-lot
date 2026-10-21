"use client";

import { Accordion } from "@base-ui/react/accordion";
import { ChevronDown, Database } from "lucide-react";
import { COLUMN_TYPE_LABELS } from "@/entities/dataset/lib/labels";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { filterOf, sameFilters } from "@/features/data-filter/model/filters";
import { ColumnFilter } from "@/features/data-filter/ui/ColumnFilter";
import { useDatasetSchema, useSchemaState } from "@/shared/api/queries";
import { EmptyState, Skeleton } from "@/shared/ui/Loading";
import styles from "./FilterPanel.module.css";

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
  const rows = useWorkspace((s) => s.draft.rows);
  // 컬럼은 데이터마다 달라 고른 데이터셋의 스키마에서 받는다.
  const schema = useDatasetSchema(rows);
  const columns = schema.data?.columns ?? [];
  const schemaState = useSchemaState(rows);
  const count = filters?.length ?? 0;
  const pending = drawn && !readOnly && !sameFilters(filters, applied);

  return (
    <section className={styles.panel} aria-label="필터">
      <header className={styles.header}>
        <strong>필터</strong>
        {count > 0 && <span className={styles.count}>{count}</span>}
        {count > 0 && !readOnly && (
          <button
            type="button"
            className={styles.clear}
            onClick={() => updateDraft({ filters: [] })}
          >
            모두 지우기
          </button>
        )}
      </header>
      <p className={styles.note} data-pending={pending || undefined}>
        {readOnly
          ? "이 차트에 적용된 필터입니다."
          : pending
            ? "바뀐 필터는 draw를 눌러야 적용됩니다."
            : "필터는 draw할 때 적용됩니다."}
      </p>
      {(schemaState === "missing" || schemaState === "generating") && (
        <EmptyState size="sm" icon={<Database size={16} />} title="컬럼 없음">
          {schemaState === "generating"
            ? "데이터 등록이 끝나면 컬럼이 나타납니다."
            : "데이터를 등록하면 컬럼이 나타납니다."}
        </EmptyState>
      )}
      {schemaState === "loading" && (
        // 컬럼 이름 자리를 잡아 둔다.
        <div className={styles.list} aria-busy="true">
          {SKELETON_WIDTHS.map((width, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 받기 전 자리 표시용
            <div key={i} className={`${styles.item} ${styles.skeletonRow}`}>
              <Skeleton width={width} />
            </div>
          ))}
        </div>
      )}
      {schemaState === "ready" && (
        <Accordion.Root multiple className={styles.list}>
          {columns.map((c) => {
            const active = filterOf(filters, c.name) !== undefined;
            return (
              <Accordion.Item
                key={c.name}
                value={c.name}
                className={styles.item}
              >
                <Accordion.Header className={styles.itemHeader}>
                  <Accordion.Trigger className={styles.trigger}>
                    <span className={styles.name}>{c.label}</span>
                    <span className={styles.type}>
                      {COLUMN_TYPE_LABELS[c.type]}
                    </span>
                    {active && (
                      <>
                        <span className={styles.activeDot} aria-hidden="true" />
                        <span className={styles.srOnly}>필터 적용됨</span>
                      </>
                    )}
                    <ChevronDown
                      size={14}
                      className={styles.chevron}
                      aria-hidden="true"
                    />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className={styles.itemPanel}>
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
