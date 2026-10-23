"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import type {
  ChartOptions,
  ChartOptionsPatch,
  OptionSection,
} from "@/entities/chart/model/chart-options";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { useDebounced } from "@/shared/lib/use-debounced";
import { linkButton } from "@/shared/ui/button";
import { ColorPickerButton } from "@/shared/ui/ColorPickerButton";
import {
  fieldsOf,
  getPath,
  type OptionField,
  SECTION_HINTS,
  SECTION_LABELS,
  SECTION_PARTS,
  setPath,
} from "../model/option-fields";

const row =
  "grid grid-cols-[minmax(0,1fr)_9.375rem] items-center gap-2 text-fg-secondary";
const check = "flex items-center gap-1.5 text-fg-secondary";
const control =
  "w-full rounded-md border border-line bg-elevated px-1.5 py-1 text-fg";

/** 숫자·글자 입력은 멈춘 뒤 이만큼 지나야(또는 칸을 벗어나야) 반영한다. 바꿀 때마다 다시 그리기 때문이다. */
const COMMIT_DELAY_MS = 600;

/**
 * 속성 구역 하나의 편집 폼. 필드 표(SECTION_FIELDS, 하위 항목이 있으면 그 항목의 필드)대로 그리고, 바꾼 값을 부분 값(patch)에 넣어 onChange로 넘긴다.
 * 보이는 값(resolved)은 기본값·공통 속성까지 합친 값이다.
 */
export function OptionSectionForm({
  section,
  part,
  resolved,
  patch,
  onChange,
  onReset,
  resetLabel,
  disabled,
  showFields = true,
  children,
}: {
  section: OptionSection;
  /** 하위 항목이 있는 구역(축)에서 보일 항목. 없으면 첫 항목 */
  part?: string;
  resolved: ChartOptions;
  patch: ChartOptionsPatch | undefined;
  onChange: (next: ChartOptionsPatch) => void;
  /** 구역을 되돌린다. 없으면 버튼을 두지 않는다. */
  onReset?: () => void;
  resetLabel: string;
  disabled: boolean;
  /** false면 필드 표를 그리지 않는다 (차트가 이 구역을 쓰지 않아 children만 보일 때) */
  showFields?: boolean;
  /** 구역 제목 아래, 필드 표 위에 붙는 내용 (속성 모델 밖에 저장하는 같은 구역 설정) */
  children?: ReactNode;
}) {
  const hint = SECTION_HINTS[section];
  const parts = SECTION_PARTS[section];
  const partLabel = (parts?.find((p) => p.id === part) ?? parts?.[0])?.label;
  const set = (path: string, value: unknown) =>
    onChange(setPath(patch, path, value));

  return (
    <div className="flex flex-col gap-2.5 text-ui">
      <h3 className="text-ui font-semibold">
        {SECTION_LABELS[section]}
        {partLabel && ` · ${partLabel}`}
      </h3>
      {children}
      {showFields && hint && <p className="text-xs text-fg-muted">{hint}</p>}
      {showFields && (
        <div className="flex flex-col gap-1.5">
          {fieldsOf(section, part).map((field) =>
            field.when && !field.when(resolved) ? null : field.kind ===
              "heading" ? (
              <h4
                key={`h-${field.label}`}
                className="mt-1.5 text-xs font-semibold text-fg-secondary"
              >
                {field.label}
              </h4>
            ) : (
              <FieldInput
                key={field.path}
                field={field}
                value={getPath(resolved, field.path)}
                disabled={disabled}
                onCommit={(value) => set(field.path, value)}
              />
            ),
          )}
        </div>
      )}
      {showFields && onReset && (
        <button
          type="button"
          className={linkButton()}
          disabled={disabled}
          onClick={onReset}
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  disabled,
  onCommit,
}: {
  field: Exclude<OptionField, { kind: "heading" }>;
  value: unknown;
  disabled: boolean;
  onCommit: (value: unknown) => void;
}) {
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
            value={String(value)}
            disabled={disabled}
            onChange={(e) => onCommit(e.target.value)}
          >
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
      return (
        <div className={row}>
          <span id={id}>{field.label}</span>
          <span className="flex items-center gap-1.5">
            <ColorPickerButton
              className="size-5.5 flex-none rounded-sm border border-line"
              style={{ background: color || "transparent" }}
              color={color || "#ffffff"}
              label={`${field.label} 바꾸기`}
              disabled={disabled}
              onCommit={onCommit}
            />
            <code className="text-2xs text-fg-muted">{color || "없음"}</code>
            {field.optional && color && (
              <button
                type="button"
                className={linkButton()}
                disabled={disabled}
                onClick={() => onCommit("")}
              >
                비우기
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
            placeholder={field.nullable ? "자동" : undefined}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            disabled={disabled}
            parse={(text) => parseNumber(text, field)}
            onCommit={onCommit}
          />
        </label>
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
 * 입력하는 동안은 글자만 바꾸고, 멈추거나 칸을 벗어나면 값을 반영한다.
 * 바깥 값이 바뀌면(되돌리기) 입력 글자도 따라간다.
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
  const debounced = useDebounced(text, COMMIT_DELAY_MS);
  const commit = useCallbackRef((next: string) => {
    if (next === value) return;
    const parsed = parse(next);
    if (parsed !== INVALID) onCommit(parsed);
  });

  useEffect(() => setText(value), [value]);
  useEffect(() => commit(debounced), [debounced, commit]);

  return (
    <input
      {...inputProps}
      className={control}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => commit(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit(text);
      }}
    />
  );
}
