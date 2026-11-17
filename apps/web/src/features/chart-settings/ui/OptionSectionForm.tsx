"use client";

import { useLingui } from "@lingui/react/macro";
import { useLocale } from "@vis-a-lot/shared/lib/i18n";
import { X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  Controller,
  type FieldPath,
  useFormContext,
  useWatch,
} from "react-hook-form";
import type {
  OptionSection,
  OrderSort,
} from "@/entities/chart/model/chart-options";
import type { ChartType, DatasetId } from "@/shared/api/types";
import { defaultLegendColor } from "@/shared/lib/palette";
import { linkButton } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import {
  fieldsOf,
  getPath,
  hasSection,
  isFieldShown,
  type OptionField,
  sectionHints,
  sectionLabels,
  sectionParts,
  sectionPaths,
} from "../model/option-fields";
import "../config/messages";
import {
  type OptionsBase,
  type OptionsFormValues,
  useOptionsPatch,
} from "../model/options-form";
import { type OrderSource, useOrderValues } from "../model/order-values";
import { OrderField } from "./OrderField";

const row =
  "grid grid-cols-[minmax(0,1fr)_9.375rem] items-center gap-2 text-fg-secondary";
const check = "flex items-center gap-1.5 text-fg-secondary";
const control =
  "w-full rounded-md border border-line bg-elevated px-1.5 py-1 text-fg";

/**
 * 속성 구역 하나의 편집 폼(react-hook-form). 필드 표(sectionFields(), 하위 항목이 있으면 그 항목의 필드)대로
 * options.<경로> 필드를 그린다. 값은 팝업의 폼에만 쓰고, 서버나 draft로 보내는 것은 팝업의 확인 버튼이다.
 */
export function OptionSectionForm({
  section,
  part,
  chartType,
  orderSource,
  original,
  base,
  resetLabel,
  disabled,
  showFields = true,
  children,
}: OptionsBase & {
  section: OptionSection;
  /** 그리는(그린) 차트 종류. 그 차트가 쓰지 않는 칸(범주 순서 등)은 숨긴다. */
  chartType: ChartType | undefined;
  /** 순서 필드가 값 목록을 받을 곳. 없으면 순서 필드에 늘어놓을 값이 없다. */
  orderSource?: OrderSource;
  /** 하위 항목이 있는 구역(축)에서 보일 항목. 없으면 첫 항목 */
  part?: string;
  /** 구역 되돌리기 버튼 글자 (기본값으로 되돌리기, 공통 속성 따르기) */
  resetLabel: string;
  disabled: boolean;
  /** false면 필드 표를 그리지 않는다 (차트가 이 구역을 쓰지 않아 children만 보일 때) */
  showFields?: boolean;
  /** 구역 제목 아래, 필드 표 위에 붙는 내용 (속성 모델 밖에 저장하는 같은 구역 설정) */
  children?: ReactNode;
}) {
  const {
    control: form,
    setValue,
    getValues,
  } = useFormContext<OptionsFormValues>();
  const values = useWatch({ control: form, name: "options" });
  const patch = useOptionsPatch({ original, base });
  // 필드 표(라벨)는 지금 언어로 읽으므로 언어가 바뀌면 다시 그린다.
  useLocale();
  const hint = sectionHints()[section];
  const parts = sectionParts()[section];
  const partLabel = (parts?.find((p) => p.id === part) ?? parts?.[0])?.label;

  // 구역을 따르는 값으로 돌리고, 저장할 때 그 구역을 부분 값에서 지우도록 표시한다.
  // 구역 객체를 한 번에 넣으면 그 아래 필드의 Controller가 다시 그려지지 않아 필드마다 넣는다.
  const reset = () => {
    for (const path of sectionPaths(section))
      setValue(
        `options.${path}` as FieldPath<OptionsFormValues>,
        getPath(base, path) as never,
        { shouldDirty: true },
      );
    const resets = getValues("resetSections");
    if (!resets.includes(section))
      setValue("resetSections", [...resets, section], { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-2.5 text-ui">
      <h3 className="text-ui font-semibold">
        {sectionLabels()[section]}
        {partLabel && ` · ${partLabel}`}
      </h3>
      {children}
      {showFields && hint && <p className="text-xs text-fg-muted">{hint}</p>}
      {showFields && (
        <div className="flex flex-col gap-1.5">
          {fieldsOf(section, part).map((field) =>
            !isFieldShown(field, values, chartType) ? null : field.kind ===
              "heading" ? (
              <h4
                key={`h-${field.label}`}
                className="mt-1.5 text-xs font-semibold text-fg-secondary"
              >
                {field.label}
              </h4>
            ) : (
              <Controller
                key={field.path}
                control={form}
                name={`options.${field.path}` as FieldPath<OptionsFormValues>}
                render={({ field: input }) =>
                  field.kind === "order" ? (
                    <OrderInput
                      field={field}
                      source={orderSource}
                      value={input.value as unknown as string[]}
                      sort={getPath(values, field.sortPath) as OrderSort}
                      disabled={disabled}
                      onCommit={input.onChange}
                    />
                  ) : (
                    <FieldInput
                      field={field}
                      value={input.value}
                      disabled={disabled}
                      onCommit={input.onChange}
                    />
                  )
                }
              />
            ),
          )}
        </div>
      )}
      {showFields && hasSection(patch, section) && (
        <button
          type="button"
          className={linkButton()}
          disabled={disabled}
          onClick={reset}
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}

const NO_VALUES: readonly string[] = [];

/** 순서 칸. 값 목록은 여는 쪽이 넘긴 곳(orderSource)에서 받는다. */
function OrderInput({
  field,
  source,
  value,
  sort,
  disabled,
  onCommit,
}: {
  field: Extract<OptionField, { kind: "order" }>;
  source: OrderSource | undefined;
  value: string[];
  sort: OrderSort;
  disabled: boolean;
  onCommit: (order: string[]) => void;
}) {
  const column =
    (field.source === "legend" ? source?.legend : source?.category) ?? null;
  const list = useOrderValues({
    kind: field.source,
    dataset: source?.dataset ?? ("" as DatasetId),
    column,
    ready: source?.ready ?? false,
  });
  return (
    <OrderField
      label={field.label}
      // legend·범주 컬럼이 없으면 늘어놓을 값이 없다.
      values={column === null ? NO_VALUES : list.values}
      value={value ?? NO_VALUES}
      sort={sort}
      onChange={onCommit}
      disabled={disabled}
      tooMany={list.tooMany}
      loading={column !== null && list.loading}
    />
  );
}

function FieldInput({
  field,
  value,
  disabled,
  onCommit,
}: {
  field: Exclude<OptionField, { kind: "heading" | "order" }>;
  value: unknown;
  disabled: boolean;
  onCommit: (value: unknown) => void;
}) {
  const { t } = useLingui();
  const id = useId();
  switch (field.kind) {
    case "boolean":
      return (
        <label className={check}>
          <input
            type="checkbox"
            checked={value === true}
            disabled={disabled}
            onChange={(e) => onCommit(e.target.checked)}
          />
          {field.label}
        </label>
      );
    case "select":
      return (
        <label className={row} htmlFor={id}>
          <span>{field.label}</span>
          <select
            id={id}
            className={control}
            value={value === null ? "" : String(value)}
            disabled={disabled}
            onChange={(e) =>
              onCommit(
                field.emptyLabel !== undefined && e.target.value === ""
                  ? null
                  : e.target.value,
              )
            }
          >
            {field.emptyLabel !== undefined && (
              <option value="">{field.emptyLabel}</option>
            )}
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "multi": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="flex flex-wrap gap-x-3 gap-y-1">
          <legend className="mb-0.5 w-full text-fg-secondary">
            {field.label}
          </legend>
          {field.options.map((o) => (
            <label key={o.value} className={check}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                disabled={disabled}
                onChange={(e) =>
                  // 표의 순서를 지킨다 (점수 상자에 적는 순서).
                  onCommit(
                    field.options
                      .map((c) => c.value)
                      .filter((v) =>
                        v === o.value ? e.target.checked : selected.includes(v),
                      ),
                  )
                }
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      );
    }
    case "color": {
      const color = typeof value === "string" ? value : "";
      const label = field.label;
      return (
        <div className={row}>
          <span id={id}>{field.label}</span>
          <span className="flex items-center gap-1.5">
            <ColorPickerButton
              className="size-5.5 flex-none rounded-sm border border-line"
              style={{ background: color || "transparent" }}
              color={color || "#ffffff"}
              label={t`${label} 바꾸기`}
              disabled={disabled}
              onCommit={onCommit}
            />
            <code className="text-2xs text-fg-muted">
              {color || t({ message: "없음", context: "no color" })}
            </code>
            {field.optional && color && (
              <button
                type="button"
                className={linkButton()}
                disabled={disabled}
                onClick={() => onCommit("")}
              >
                {t({ message: "비우기", context: "clear color" })}
              </button>
            )}
          </span>
        </div>
      );
    }
    case "number":
      return (
        <label className={row} htmlFor={id}>
          <span>{field.label}</span>
          <DraftInput
            id={id}
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            placeholder={
              field.placeholder ??
              (field.nullable
                ? t({ message: "자동", context: "chart option" })
                : undefined)
            }
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
            parse={(text) => parseNumber(text, field)}
            onCommit={onCommit}
          />
        </label>
      );
    case "colors":
      return (
        <ColorsInput
          field={field}
          value={value}
          disabled={disabled}
          onCommit={onCommit}
        />
      );
    case "text":
      return (
        <label className={row} htmlFor={id}>
          <span>{field.label}</span>
          <DraftInput
            id={id}
            type="text"
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            disabled={disabled}
            parse={(text) => text}
            onCommit={onCommit}
          />
        </label>
      );
  }
}

/** 색 목록 칸 (팔레트 색). 색마다 바꾸기·빼기, 끝에 더하기. 비우면 기본 팔레트를 따른다. */
function ColorsInput({
  field,
  value,
  disabled,
  onCommit,
}: {
  field: Extract<OptionField, { kind: "colors" }>;
  value: unknown;
  disabled: boolean;
  onCommit: (value: unknown) => void;
}) {
  const { t } = useLingui();
  const colors = Array.isArray(value) ? (value as string[]) : [];
  const label = field.label;
  return (
    <div className="flex flex-col gap-1 text-fg-secondary">
      <div className="flex items-center justify-between gap-2">
        <span>{field.label}</span>
        {colors.length > 0 && (
          <button
            type="button"
            className={linkButton()}
            disabled={disabled}
            onClick={() => onCommit([])}
          >
            {t({ message: "기본 팔레트로", context: "palette colors" })}
          </button>
        )}
      </div>
      <ul className="flex flex-wrap items-center gap-1.5">
        {colors.map((color, i) => {
          const n = i + 1;
          return (
            // 같은 색이 두 번 있을 수 있어 자리로 구분한다.
            // biome-ignore lint/suspicious/noArrayIndexKey: 목록 자리가 곧 legend 순번이다.
            <li key={i} className="flex items-center">
              <ColorPickerButton
                className="size-5.5 flex-none rounded-sm border border-line"
                style={{ background: color }}
                color={color}
                label={t({
                  message: `${label} ${n}번째 색 바꾸기`,
                  comment: "{label}은 칸 이름(색 목록), {n}은 목록 안 순번",
                })}
                disabled={disabled}
                onCommit={(next) =>
                  onCommit(colors.map((c, k) => (k === i ? next : c)))
                }
              />
              <button
                type="button"
                className="grid size-4 place-items-center rounded-sm text-fg-muted hover:text-fg disabled:opacity-50"
                aria-label={t({
                  message: `${n}번째 색 빼기`,
                  comment: "{n}은 색 목록 안 순번",
                })}
                disabled={disabled}
                onClick={() => onCommit(colors.filter((_, k) => k !== i))}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          );
        })}
        {colors.length < field.max && (
          <li>
            <button
              type="button"
              className={linkButton()}
              disabled={disabled}
              onClick={() =>
                onCommit([...colors, defaultLegendColor(colors.length)])
              }
            >
              {t({ message: "색 더하기", context: "palette colors" })}
            </button>
          </li>
        )}
      </ul>
      {field.hint && <p className="text-xs text-fg-muted">{field.hint}</p>}
    </div>
  );
}

/** 숫자 칸의 글자를 값으로. 비우면 null(자동, nullable일 때만), 잘못된 값이면 INVALID */
export const INVALID = Symbol("invalid");
export function parseNumber(
  text: string,
  field: { min: number; max: number; nullable?: boolean },
): number | null | typeof INVALID {
  const trimmed = text.trim();
  if (trimmed === "") return field.nullable ? null : INVALID;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return INVALID;
  return Math.min(field.max, Math.max(field.min, n));
}

/**
 * 입력한 글자는 그대로 두고, 값으로 읽히면 바로 폼에 넣는다. 입력 도중의 글자('1.', '-')를
 * 정리하지 않도록, 폼 값이 글자와 다르게 바뀌었을 때(되돌리기)만 글자를 따라 바꾼다.
 */
function DraftInput({
  value,
  parse,
  onCommit,
  ...inputProps
}: {
  value: string;
  parse: (text: string) => unknown;
  onCommit: (value: unknown) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "onBlur"
>) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  // 글자가 바뀔 때가 아니라 폼 값이 바뀔 때만 맞춘다.
  if (value !== prevValue) {
    setPrevValue(value);
    const parsed = parse(text);
    if (value !== (parsed === INVALID ? undefined : String(parsed ?? "")))
      setText(value);
  }

  return (
    <input
      {...inputProps}
      className={control}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const next = parse(e.target.value);
        if (next !== INVALID) onCommit(next);
      }}
    />
  );
}
