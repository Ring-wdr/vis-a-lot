"use client";

import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
  type OptionSection,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { OptionsItem } from "@/entities/workspace/model/workspace-store";
import styles from "@/shared/ui/workspace.module.css";
import { OptionsAccordion } from "./OptionsAccordion";

/**
 * item 개별 속성. 보이는 값은 기본값 → 공통 → item 순으로 합친 값이고, 바꾸면 item 속성 전체를 보낸다.
 * 보낼 요청(onChange)은 패널이 그 item의 조작으로 이어 준다.
 */
export function ItemOptions({
  item,
  sections,
  busy,
  onChange,
}: {
  item: OptionsItem;
  sections: readonly OptionSection[];
  /** 그 item을 다시 그리는 중. 입력은 막지 않고, 끝난 뒤 마지막 값을 보낸다. */
  busy: boolean;
  onChange: (options: ChartOptionsPatch | undefined) => void;
}) {
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const common = useWorkspace(
    (s) => s.current?.spec.common.options as ChartOptionsPatch | undefined,
  );
  const readOnly = useWorkspace((s) => s.readOnly);
  const patch = item.options as ChartOptionsPatch | undefined;

  return (
    <>
      <OptionsAccordion
        sections={sections}
        supported={(s) => supportsOption(chartType, s)}
        resolved={mergeOptions<ChartOptions>(
          mergeOptions<ChartOptions>(DEFAULT_OPTIONS, common),
          patch,
        )}
        patch={patch}
        disabled={readOnly}
        onChange={onChange}
        resetLabel="이 구역은 공통 속성 따르기"
      />
      <p className={styles.muted}>
        {busy || item.dirty
          ? "바꾼 값을 모아 이 item만 다시 그립니다."
          : "바꾸면 이 item만 다시 그립니다. 공통 속성을 바꾸면 item별 속성은 모두 공통 속성으로 바뀝니다."}
      </p>
    </>
  );
}
