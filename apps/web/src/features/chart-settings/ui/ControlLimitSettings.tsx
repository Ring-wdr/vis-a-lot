"use client";

import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { tv } from "@vis-a-lot/shared/lib/tw";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  type FieldPath,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import {
  LIMIT_FNS,
  LIMIT_STYLES,
  LIMIT_TYPES,
  type LimitAxis,
  type LimitFn,
  type LimitKind,
  type LimitLine,
  type LimitStyle,
  type LimitSupport,
  type LimitType,
  MAX_LIMIT_LINES,
  MAX_LIMIT_NAME,
} from "@/entities/chart/model/chart-options";
import {
  isTimeValue,
  type LimitIssue,
} from "@/entities/chart/model/control-limit";
import type { ColumnInfo } from "@/shared/api/types";
import { button } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import "../config/messages";
import {
  addableKinds,
  axesFor,
  checkLimitLines,
  isoToKstInput,
  kstInputToIso,
  type LimitSource,
  limitIssueText,
  newLimitLine,
  numericColumns,
  uniqueLimitName,
  withAxis,
} from "../model/control-limit-form";
import type { OptionsFormValues } from "../model/options-form";
import { DraftInput, parseNumber } from "./DraftInput";

const KIND: Record<LimitKind, MessageDescriptor> = {
  reference: msg({ message: "기준선", context: "control limit kind" }),
  column: msg({ message: "컬럼 선", context: "control limit kind" }),
  band: msg({ message: "띠", context: "control limit kind" }),
};
const FN: Record<LimitFn, MessageDescriptor> = {
  avg: msg({ message: "평균", context: "control limit fn" }),
  max: msg({ message: "최댓값", context: "control limit fn" }),
  median: msg({ message: "중앙값", context: "control limit fn" }),
  min: msg({ message: "최솟값", context: "control limit fn" }),
};
const TYPE: Record<LimitType, MessageDescriptor | string> = {
  none: msg({ message: "없음", context: "control limit type" }),
  usl: "USL",
  lsl: "LSL",
};
const STYLE: Record<LimitStyle, MessageDescriptor> = {
  solid: msg({ message: "실선", context: "control limit style" }),
  dash: msg({ message: "파선", context: "control limit style" }),
  dot: msg({ message: "점선", context: "control limit style" }),
};
/** 축 이름은 그림의 축 위치라 번역하지 않는다. */
const AXIS: Record<LimitAxis, string> = { left: "Left", bottom: "Bottom" };

const styles = tv({
  slots: {
    list: "flex flex-col gap-2",
    card: "flex flex-col gap-1.5 rounded-md border border-line bg-panel-subtle p-2 data-invalid:border-danger",
    head: "flex items-center gap-1.5",
    kind: "flex-none rounded-sm bg-accent-soft px-1.5 py-0.5 text-2xs font-semibold text-accent",
    icon: "grid size-6 flex-none cursor-pointer place-items-center rounded-sm text-fg-muted enabled:hover:bg-panel-hover enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-35",
    grid: "grid grid-cols-2 gap-x-2.5 gap-y-1.5",
    cell: "flex min-w-0 flex-col gap-0.5 text-xs text-fg-secondary",
    wide: "col-span-2",
    control:
      "w-full rounded-md border border-line bg-elevated px-1.5 py-1 text-ui text-fg",
    check: "flex items-center gap-1.5 text-xs text-fg-secondary",
    issue: "text-xs text-danger",
    add: "flex items-center gap-2",
  },
});
const s = styles();

const LINES = "options.controlLimit.lines" as const;

/**
 * 관리선 구역의 선 목록 (useFieldArray). 종류를 골라 더하고, 선마다 그 종류의 칸만 보인다.
 * 고를 수 있는 종류·축·구간별은 그 차트가 쓰는 것(controlLimitSupport)만이고, 컬럼은 숫자 컬럼만 보인다.
 * 서버와 같은 규칙으로 맞지 않는 선에 사유를 적는다 (확인 버튼은 팝업이 막는다).
 */
export function ControlLimitSettings({
  source,
  disabled,
}: {
  source: LimitSource | undefined;
  disabled: boolean;
}) {
  const { i18n, t } = useLingui();
  const { control, setValue } = useFormContext<OptionsFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: LINES,
  });
  const lines = useWatch({ control, name: LINES }) ?? [];
  const support = source?.support;
  const kinds = support ? addableKinds(support) : [];
  const [kind, setKind] = useState<LimitKind>("reference");
  const adding = kinds.includes(kind) ? kind : kinds[0];
  const kindSelectId = useId();
  if (!source || !support) return null;
  const { issues } = checkLimitLines(lines, source);
  const full = lines.length >= MAX_LIMIT_LINES;
  const max = MAX_LIMIT_LINES;
  const numeric = numericColumns(source);

  /** 선 하나를 바꾼다. 선 객체를 통째로 넣어도 field id가 그대로라 입력 칸이 다시 만들어지지 않는다. */
  const change = (index: number, next: LimitLine) =>
    setValue(
      `${LINES}.${index}` as FieldPath<OptionsFormValues>,
      next as never,
      { shouldDirty: true },
    );

  return (
    <div className="flex flex-col gap-2">
      <h4 className="mt-1.5 text-xs font-semibold text-fg-secondary">
        <Trans>선 목록</Trans>
      </h4>
      {fields.length === 0 && (
        <p className="text-xs text-fg-muted">
          <Trans>
            선이 없습니다. 종류를 골라 더하세요. 이름과 값은 PNG에 적은 그대로
            그립니다.
          </Trans>
        </p>
      )}
      <ol className={s.list()}>
        {fields.map((field, index) => {
          const line = (lines[index] ?? field) as LimitLine;
          return (
            <LimitLineEditor
              key={field.id}
              index={index}
              count={fields.length}
              line={line}
              issue={issues[index]}
              support={support}
              source={source}
              numeric={numeric}
              disabled={disabled}
              onChange={(next) => change(index, next)}
              onMove={(to) => move(index, to)}
              onRemove={() => remove(index)}
            />
          );
        })}
      </ol>
      {!disabled && adding && (
        <div className={s.add()}>
          <label className="sr-only" htmlFor={kindSelectId}>
            <Trans>더할 선 종류</Trans>
          </label>
          <select
            id={kindSelectId}
            className={s.control({ class: "w-auto" })}
            value={adding}
            disabled={full}
            onChange={(e) => setKind(e.target.value as LimitKind)}
          >
            {kinds.map((k) => (
              <option key={k} value={k}>
                {i18n._(KIND[k])}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={full}
            title={full ? t`관리선은 ${max}개까지입니다.` : undefined}
            onClick={() =>
              append(
                newLimitLine(
                  adding,
                  { ...source, support },
                  lines,
                  uniqueLimitName(i18n._(KIND[adding]), lines),
                ),
              )
            }
          >
            <Plus size={14} aria-hidden="true" />
            <Trans>선 더하기</Trans>
          </button>
        </div>
      )}
    </div>
  );
}

/** 선 하나. 그 종류에 없는 칸은 그리지 않는다. */
function LimitLineEditor({
  index,
  count,
  line,
  issue,
  support,
  source,
  numeric,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  line: LimitLine;
  issue: LimitIssue | undefined;
  support: LimitSupport;
  source: LimitSource;
  numeric: readonly ColumnInfo[];
  disabled: boolean;
  onChange: (next: LimitLine) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const { i18n, t } = useLingui();
  const id = useId();
  const n = index + 1;
  const name = line.name || String(n);
  // 지금 축이 그 종류를 못 쓰면(차트를 바꿈) 그대로 보이고 사유를 적는다.
  const axes = axesFor(support, line.kind);
  const axisChoices = axes.includes(line.axis) ? axes : [...axes, line.axis];
  const showMulti =
    line.kind !== "reference" &&
    ((support.multi && line.axis === "left") || line.multi);

  return (
    <li className={s.card()} data-invalid={issue !== undefined || undefined}>
      <div className={s.head()}>
        <span className={s.kind()}>{i18n._(KIND[line.kind])}</span>
        <label className="sr-only" htmlFor={`${id}-name`}>
          <Trans>선 이름</Trans>
        </label>
        <DraftInput
          id={`${id}-name`}
          type="text"
          className="min-w-0 flex-1"
          value={line.name}
          maxLength={MAX_LIMIT_NAME}
          placeholder={t`이름 (PNG에 그대로 적음)`}
          disabled={disabled}
          parse={(text) => text}
          onCommit={(value) => onChange({ ...line, name: String(value) })}
        />
        <button
          type="button"
          className={s.icon()}
          aria-label={t({
            message: `${name} 선을 위로`,
            comment: "name: 선 이름",
          })}
          disabled={disabled || index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={s.icon()}
          aria-label={t({
            message: `${name} 선을 아래로`,
            comment: "name: 선 이름",
          })}
          disabled={disabled || index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={s.icon()}
          aria-label={t({
            message: `${name} 선 지우기`,
            comment: "name: 선 이름",
          })}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>

      <div className={s.grid()}>
        <Cell
          label={t({ message: "축", context: "control limit" })}
          id={`${id}-axis`}
        >
          <select
            id={`${id}-axis`}
            className={s.control()}
            value={line.axis}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                withAxis(line, e.target.value as LimitAxis, source.xType),
              )
            }
          >
            {axisChoices.map((axis) => (
              <option key={axis} value={axis}>
                {AXIS[axis]}
              </option>
            ))}
          </select>
        </Cell>

        {line.kind !== "band" && (
          <Cell label={t`규격`} id={`${id}-type`}>
            <select
              id={`${id}-type`}
              className={s.control()}
              value={line.type}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...line, type: e.target.value as LimitType })
              }
            >
              {LIMIT_TYPES.map((type) => {
                const label = TYPE[type];
                return (
                  <option key={type} value={type}>
                    {typeof label === "string" ? label : i18n._(label)}
                  </option>
                );
              })}
            </select>
          </Cell>
        )}

        {line.kind === "reference" &&
          (isTimeValue(line, source.xType) ? (
            <Cell label={t`시각 (KST)`} id={`${id}-value`}>
              <DraftInput
                id={`${id}-value`}
                type="datetime-local"
                className="text-ui"
                value={
                  typeof line.value === "string"
                    ? isoToKstInput(line.value)
                    : ""
                }
                disabled={disabled}
                parse={kstInputToIso}
                onCommit={(value) =>
                  onChange({ ...line, value: String(value) })
                }
              />
            </Cell>
          ) : (
            <Cell
              label={t({ message: "값", context: "control limit" })}
              id={`${id}-value`}
            >
              <DraftInput
                id={`${id}-value`}
                type="number"
                className="text-ui"
                value={typeof line.value === "number" ? String(line.value) : ""}
                disabled={disabled}
                parse={(text) => parseNumber(text, { min: -1e15, max: 1e15 })}
                onCommit={(value) =>
                  onChange({ ...line, value: Number(value) })
                }
              />
            </Cell>
          ))}

        {line.kind !== "reference" && (
          <Cell
            label={
              line.kind === "band"
                ? t({ message: "컬럼 1", context: "control limit band" })
                : t({ message: "컬럼", context: "control limit" })
            }
            id={`${id}-column`}
          >
            <ColumnSelect
              id={`${id}-column`}
              value={line.column}
              columns={numeric}
              disabled={disabled}
              onChange={(column) => onChange({ ...line, column })}
            />
          </Cell>
        )}

        {line.kind === "column" && (
          <Cell label={t`함수`} id={`${id}-fn`}>
            <select
              id={`${id}-fn`}
              className={s.control()}
              value={line.fn}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...line, fn: e.target.value as LimitFn })
              }
            >
              {LIMIT_FNS.map((fn) => (
                <option key={fn} value={fn}>
                  {i18n._(FN[fn])}
                </option>
              ))}
            </select>
          </Cell>
        )}

        {line.kind === "band" && (
          <Cell
            label={t({ message: "컬럼 2", context: "control limit band" })}
            id={`${id}-column2`}
          >
            <ColumnSelect
              id={`${id}-column2`}
              value={line.column2}
              columns={numeric}
              disabled={disabled}
              onChange={(column2) => onChange({ ...line, column2 })}
            />
          </Cell>
        )}

        <Cell label={t({ message: "색", context: "chart option" })}>
          <span className="flex items-center gap-1.5">
            <ColorPickerButton
              className="size-5.5 flex-none rounded-sm border border-line"
              style={{ background: line.color }}
              color={line.color}
              label={t({
                message: `${name} 선 색 바꾸기`,
                comment: "name: 선 이름",
              })}
              disabled={disabled}
              onCommit={(color) => onChange({ ...line, color })}
            />
            <code className="text-2xs text-fg-muted">{line.color}</code>
          </span>
        </Cell>

        <Cell label={t`굵기`} id={`${id}-width`}>
          <DraftInput
            id={`${id}-width`}
            type="number"
            className="text-ui"
            min={0.5}
            max={10}
            step={0.5}
            value={String(line.width)}
            disabled={disabled}
            parse={(text) => parseNumber(text, { min: 0.5, max: 10 })}
            onCommit={(value) => onChange({ ...line, width: Number(value) })}
          />
        </Cell>

        <Cell
          label={t({ message: "모양", context: "control limit style" })}
          id={`${id}-style`}
        >
          <select
            id={`${id}-style`}
            className={s.control()}
            value={line.style}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...line, style: e.target.value as LimitStyle })
            }
          >
            {LIMIT_STYLES.map((style) => (
              <option key={style} value={style}>
                {i18n._(STYLE[style])}
              </option>
            ))}
          </select>
        </Cell>

        {showMulti && (
          <label className={s.check({ class: "self-end" })}>
            <input
              type="checkbox"
              checked={line.multi}
              disabled={disabled}
              onChange={(e) => onChange({ ...line, multi: e.target.checked })}
            />
            <Trans>구간별 값 (계단선)</Trans>
          </label>
        )}
      </div>
      {issue && <p className={s.issue()}>{limitIssueText(issue)}</p>}
    </li>
  );
}

/** 칸 하나: 위에 이름, 아래에 입력. id가 없으면(색 버튼) 이름은 글자만이다. */
function Cell({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.cell()}>
      {id ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
      {children}
    </div>
  );
}

/** 숫자 컬럼 select. 지금 값이 목록에 없으면(데이터셋을 바꿈, 받는 중) 그 이름을 그대로 둔다. */
function ColumnSelect({
  id,
  value,
  columns,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  columns: readonly ColumnInfo[];
  disabled: boolean;
  onChange: (column: string) => void;
}) {
  const { t } = useLingui();
  const missing = !columns.some((c) => c.name === value);
  return (
    <select
      id={id}
      className={s.control()}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {missing && (
        <option value={value} disabled>
          {value || t`컬럼 고르기`}
        </option>
      )}
      {columns.map((c) => (
        <option key={c.name} value={c.name}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
