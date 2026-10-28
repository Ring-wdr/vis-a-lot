"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { useEffect } from "react";
import { CHART_LABELS } from "@/entities/chart/lib/title";
import { ChartIcon } from "@/entities/chart/ui/ChartIcon";
import {
  columnsOfTypes,
  fitSpecToSchema,
  legendColumns,
} from "@/entities/dataset/model/column-roles";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { GridPicker } from "@/features/change-grid/ui/GridPicker";
import { DatasetSelect } from "@/features/register-dataset/ui/DatasetSelect";
import { useDatasetSchema, useSchemaState } from "@/shared/api/queries";
import {
  type AggFn,
  CHART_TYPES,
  type ChartType,
  type ColumnInfo,
  type ColumnName,
} from "@/shared/api/types";
import {
  CHART_FIELDS,
  fieldLabel,
  isDistributionLine,
  SUB_TYPES,
  subTypeLabel,
  subTypeOf,
  usesLegendColumn,
} from "@/shared/config/chart-kinds";
import { AGG_FNS, aggLabel } from "@/shared/config/dataset";
import { LoadingText } from "@/shared/ui/Loading";
import { type Option, OrderedSelect } from "@/shared/ui/OrderedSelect";
import { Select, type SelectOption } from "@/shared/ui/Select";
import "../config/messages";

/** legend 없음. select는 빈 값을 '고르지 않음'으로 보므로 컬럼 이름이 될 수 없는 값을 쓴다. */
const NO_LEGEND = "\u0000none";
/** 지금 언어의 통계 함수 목록 */
const aggOptions = (): SelectOption<AggFn>[] =>
  AGG_FNS.map((fn) => ({ value: fn, label: aggLabel(fn) }));
const CHART_OPTIONS: SelectOption<ChartType>[] = CHART_TYPES.map((type) => ({
  value: type,
  label: CHART_LABELS[type],
  icon: <ChartIcon type={type} size={16} />,
}));
/** 하위 차트가 없는 차트의 서브 차트 칸 */
const NO_SUB_TYPE = "none";

function toOptions(columns: readonly ColumnInfo[]): Option<ColumnName>[] {
  return columns.map((c) => ({ value: c.name, label: c.label }));
}

/**
 * 차트 설정. draw를 눌러야 반영된다. 다시 보기 전용 화면(history)에서는 그 차트의 설정을 보여주기만 하고
 * fieldset disabled로 안의 입력을 모두 막는다.
 */
export function ControlPanel() {
  // 통계 함수·축·하위 차트 이름(aggLabel 등)도 지금 언어로 읽으므로 useLingui가 언어 변경을 구독한다.
  const { t } = useLingui();
  const none = t({
    message: "없음",
    context: "no sub chart / no legend option",
  });
  const draft = useWorkspace((s) => s.draft);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const readOnly = useWorkspace((s) => s.readOnly);
  // 컬럼은 데이터마다 달라 고른 데이터셋의 스키마에서 후보를 고른다.
  const schema = useDatasetSchema(draft.dataset);
  const columns = schema.data?.columns;
  const schemaState = useSchemaState(draft.dataset);
  const noColumns =
    schemaState === "loading" ? (
      <LoadingText announce={false}>
        <Trans>컬럼 불러오는 중</Trans>
      </LoadingText>
    ) : schemaState === "generating" ? (
      t`데이터 등록이 끝나면 고를 수 있습니다`
    ) : schemaState === "missing" ? (
      t`데이터를 등록하면 고를 수 있습니다`
    ) : schemaState === "deleted" ? (
      t`삭제된 데이터라 고를 컬럼이 없습니다`
    ) : undefined;

  // 스키마를 처음 받았거나 데이터셋을 바꿨으면, 맞지 않는 설정을 기본값으로 바로잡는다.
  useEffect(() => {
    if (readOnly || !columns) return;
    const patch = fitSpecToSchema(draft, columns);
    if (patch) updateDraft(patch);
  }, [readOnly, columns, draft, updateDraft]);

  const allOptions = toOptions(columns ?? []);
  const fields = CHART_FIELDS[draft.chartType];
  const subTypes = SUB_TYPES[draft.chartType];
  // 분포 line(ECDF 등)은 y 컬럼 하나의 분포라 x를 고르지 않는다.
  const distribution = isDistributionLine(draft);
  const sunburst = draft.chartType === "pie" && subTypeOf(draft) === "sunburst";
  const optionsOf = (types: readonly ColumnInfo["type"][]) =>
    toOptions(columnsOfTypes(columns ?? [], types));

  return (
    // 다시 보기 전용이면 통째로 막는다. 안쪽 링크 버튼은 group/controls로 숨긴다.
    <fieldset
      className="group/controls flex min-w-0 flex-col gap-3.5"
      disabled={readOnly}
    >
      <DatasetSelect
        dataset={draft.dataset}
        onChange={(dataset) => updateDraft({ dataset })}
      />

      {/* 차트 종류가 늘어도 한 줄 높이를 지키도록 버튼 격자 대신 select 둘을 나란히 둔다. */}
      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-2">
        <Select
          label={t({ message: "차트", context: "chart type select" })}
          value={draft.chartType}
          options={CHART_OPTIONS}
          onChange={(type) => {
            if (type === draft.chartType) return;
            // 차트 종류마다 x축에 쓸 수 있는 타입이 달라 그에 맞게 바로잡는다. 하위 차트는 기본으로 돌린다.
            const next = { ...draft, chartType: type, subType: null };
            updateDraft({
              chartType: type,
              subType: null,
              ...(columns && fitSpecToSchema(next, columns)),
            });
          }}
        />
        <Select
          label={t`서브 차트`}
          value={subTypeOf(draft) ?? NO_SUB_TYPE}
          disabled={!subTypes}
          options={
            subTypes
              ? subTypes.map((sub) => ({
                  value: sub,
                  label: subTypeLabel(sub),
                }))
              : [{ value: NO_SUB_TYPE, label: none }]
          }
          onChange={(subType) => updateDraft({ subType })}
        />
      </div>

      <GridPicker />

      {!distribution && (
        <Select
          label={fieldLabel(draft.chartType, "x")}
          value={draft.x || null}
          placeholder={noColumns}
          options={optionsOf(fields.x)}
          onChange={(x) => updateDraft({ x })}
        />
      )}

      {fields.y && (
        <Select
          label={
            distribution
              ? t`분포를 볼 값 (y)`
              : fieldLabel(draft.chartType, "y")
          }
          value={draft.y || null}
          placeholder={noColumns}
          options={optionsOf(fields.y)}
          onChange={(y) => updateDraft({ y })}
        />
      )}

      {fields.z && (
        <Select
          label={fieldLabel(draft.chartType, "z")}
          value={draft.z || null}
          placeholder={noColumns}
          options={optionsOf(fields.z)}
          onChange={(z) => updateDraft({ z })}
        />
      )}

      {usesLegendColumn(draft) && (
        <Select
          label={sunburst ? t`legend (바깥 고리)` : "legend"}
          value={draft.legend ?? NO_LEGEND}
          options={[
            { value: NO_LEGEND, label: none },
            ...toOptions(legendColumns(columns ?? [])),
          ]}
          onChange={(legend) =>
            updateDraft({ legend: legend === NO_LEGEND ? null : legend })
          }
        />
      )}

      {fields.agg && (
        <Select
          label={t`통계 함수`}
          value={draft.agg}
          options={aggOptions()}
          onChange={(agg) => updateDraft({ agg })}
        />
      )}

      <OrderedSelect
        label="split by"
        options={allOptions}
        value={draft.splitBy}
        onChange={(splitBy) => updateDraft({ splitBy })}
      />

      <OrderedSelect
        label="tooltip"
        options={allOptions.filter(
          (o) => o.value !== draft.x && o.value !== draft.y,
        )}
        value={draft.tooltip}
        placeholder={t`x, y 외 컬럼 추가…`}
        onChange={(tooltip) => updateDraft({ tooltip })}
      />
    </fieldset>
  );
}
