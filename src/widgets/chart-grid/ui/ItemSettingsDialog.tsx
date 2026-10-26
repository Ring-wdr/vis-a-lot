"use client";

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  mergeOptions,
  useDefaultOptions,
} from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { buildPatch } from "@/features/chart-settings/model/option-fields";
import type { OptionsFormValues } from "@/features/chart-settings/model/options-form";
import { ItemOptionsDialog } from "@/features/chart-settings/ui/ItemOptionsDialog";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import {
  ITEM_PROPS_UNCHANGED,
  type ItemPropsForm,
  itemPropsChanges,
} from "@/features/item-actions/model/item-props-form";
import {
  ItemColorSettings,
  ItemLegendPositionSettings,
} from "@/features/item-actions/ui/ItemSettings";
import { useChartDefaults } from "@/shared/api/queries";
import type {
  ChartOptionsBody,
  ItemState,
  LegendPosition,
} from "@/shared/api/types";

type ItemSettingsFormValues = OptionsFormValues & ItemPropsForm;

/**
 * item 속성 팝업과 그 폼. 열린 동안만 그리므로 열 때마다 지금 item 값에서 시작한다.
 * 차트 속성(chart-settings)과 색·legend 위치(item-actions)를 한 폼에 두고, 확인을 누르면 바꾼 것만
 * 한 요청(settings)으로 보내 그 item만 한 번 다시 그린다.
 */
export function ItemSettingsDialog({
  item,
  hasLegend,
  commonPosition,
  onAction,
  onClose,
}: {
  item: ItemState & { image: NonNullable<ItemState["image"]> };
  hasLegend: boolean;
  commonPosition: LegendPosition;
  onAction: (action: ItemAction) => void;
  onClose: () => void;
}) {
  const readOnly = useWorkspace((s) => s.readOnly);
  const common = useWorkspace((s) => s.current?.spec.common);
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const defaults = useDefaultOptions(chartType);
  const chartDefaults = useChartDefaults();
  // 따르기 기준(공통 속성)과 열 때의 값. 팝업이 열린 동안에는 고정한다.
  const [opened] = useState(() => {
    const original = item.options as ChartOptionsPatch | undefined;
    const base = mergeOptions<ChartOptions>(
      defaults,
      common?.options as ChartOptionsPatch | undefined,
    );
    return {
      original,
      base,
      options: mergeOptions<ChartOptions>(base, original),
    };
  });
  const form = useForm<ItemSettingsFormValues>({
    defaultValues: {
      options: opened.options,
      resetSections: [],
      ...ITEM_PROPS_UNCHANGED,
    },
  });

  const confirm = form.handleSubmit((values) => {
    const patch = buildPatch({
      original: opened.original,
      opened: opened.options,
      base: opened.base,
      values: values.options,
      resets: values.resetSections,
    });
    const settings = {
      ...itemPropsChanges(values),
      ...(JSON.stringify(patch) !== JSON.stringify(opened.original) && {
        options: (patch ?? null) as ChartOptionsBody | null,
      }),
    };
    if (Object.keys(settings).length > 0)
      onAction({ type: "settings", settings });
    onClose();
  });

  return (
    <FormProvider {...form}>
      <ItemOptionsDialog
        itemKey={item.key}
        label={item.label}
        original={opened.original}
        base={opened.base}
        extras={{
          // legend가 없는 item은 위치를 고를 것이 없다.
          legend: hasLegend ? (
            <ItemLegendPositionSettings
              item={item}
              disabled={readOnly}
              commonPosition={commonPosition}
            />
          ) : undefined,
          palette: (
            <ItemColorSettings
              item={item}
              disabled={readOnly}
              hasLegend={hasLegend}
              common={{
                color: common?.color ?? chartDefaults.common.color,
                legendColors: common?.legendColors,
              }}
            />
          ),
        }}
        onConfirm={confirm}
        onCancel={onClose}
      />
    </FormProvider>
  );
}
