"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { segmented } from "@vis-a-lot/shared/ui/segmented";
import { Unlink } from "lucide-react";
import type { ReactNode } from "react";
import type { ColumnName, LinkColumns, LinkMode } from "@/shared/api/types";
import { button } from "@/shared/ui/button";
import { Select, type SelectOption } from "@/shared/ui/Select";
import "../config/messages";

const seg = segmented();

/** 따를 칸 후보 하나 */
export type SourceOption = {
  id: string;
  number: number;
  /** 차트 · 데이터셋 */
  label: string;
  /** 고를 수 없으면 그 까닭 */
  disabledReason?: string;
};

/** 데이터셋이 다를 때 고르는 연결 컬럼 */
export type ColumnsField = {
  source: readonly SelectOption<ColumnName>[];
  target: readonly SelectOption<ColumnName>[];
  value: LinkColumns | undefined;
  onChange: (on: LinkColumns) => void;
};

const sectionTitle = "text-2xs font-semibold text-fg-muted";

/** 따를 칸 후보 한 줄: 번호 · 차트 · 데이터셋. 고를 수 없으면 까닭을 아래에 적는다. */
function SourceRow({
  option,
  selected,
  onPick,
}: {
  option: SourceOption;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  const { t } = useLingui();
  const { id, number, label, disabledReason } = option;
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-md border border-transparent px-2 py-1 text-left enabled:hover:bg-panel-hover disabled:cursor-not-allowed aria-pressed:border-accent-line aria-pressed:bg-accent-soft"
      aria-pressed={selected}
      disabled={disabledReason !== undefined}
      title={disabledReason}
      onClick={() => !selected && onPick(id)}
    >
      <span className="flex w-full min-w-0 items-baseline gap-1.5">
        <span className="font-semibold tabular-nums">{t`칸 ${number}`}</span>
        <span className="min-w-0 truncate text-fg-secondary">{label}</span>
      </span>
      {disabledReason && (
        <span className="text-2xs text-fg-muted">{disabledReason}</span>
      )}
    </button>
  );
}

/**
 * 연결 popover의 내용 (표현). 따를 칸 목록, 방식, 연결 컬럼(데이터셋이 다를 때), 지금 상태, 연결 풀기.
 * 값과 콜백은 LinkPopover가 넘긴다.
 */
export function LinkSettings({
  number,
  sources,
  follow,
  onFollow,
  mode,
  highlightBlocked,
  onMode,
  columns,
  status,
  error,
  onUnlink,
}: {
  /** 이 칸 번호 */
  number: number;
  sources: readonly SourceOption[];
  /** 따르는 칸 id. 없으면 null */
  follow: string | null;
  onFollow: (id: string) => void;
  mode: LinkMode;
  /** 강조를 쓸 수 없으면 그 까닭 */
  highlightBlocked?: string;
  onMode: (mode: LinkMode) => void;
  columns?: ColumnsField;
  /** 지금 걸린 범위나 걸리지 않는 까닭 */
  status?: ReactNode;
  /** 서버가 연결을 거절한 사유 */
  error?: string;
  onUnlink: () => void;
}) {
  const { t } = useLingui();
  const linked = follow !== null;
  return (
    <div className="flex w-72 max-w-full flex-col gap-3 text-ui">
      <fieldset className="flex flex-col gap-1">
        <legend className={sectionTitle}>
          <Trans comment="number: 연결을 고치는 칸의 번호">
            칸 {number}의 따를 칸
          </Trans>
        </legend>
        {sources.length === 0 ? (
          <p className="text-xs text-fg-muted">
            <Trans>따를 수 있는 다른 칸이 없습니다. 칸을 더해 주세요.</Trans>
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sources.map((o) => (
              <li key={o.id}>
                <SourceRow
                  option={o}
                  selected={o.id === follow}
                  onPick={onFollow}
                />
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1" disabled={!linked}>
        <legend className={sectionTitle}>
          <Trans>방식</Trans>
        </legend>
        <div className={seg.root()}>
          <button
            type="button"
            className={seg.item()}
            aria-pressed={linked && mode === "filter"}
            onClick={() => mode !== "filter" && onMode("filter")}
          >
            {t({ message: "거르기", context: "link mode" })}
          </button>
          <button
            type="button"
            className={seg.item()}
            aria-pressed={linked && mode === "highlight"}
            disabled={highlightBlocked !== undefined}
            title={highlightBlocked}
            onClick={() => mode !== "highlight" && onMode("highlight")}
          >
            {t({ message: "강조", context: "link mode" })}
          </button>
        </div>
        <p className="text-2xs text-fg-muted">
          {mode === "highlight" ? (
            <Trans>모든 행을 그리고 범위 밖 점을 흐리게 합니다.</Trans>
          ) : (
            <Trans>범위 안의 행만으로 그립니다.</Trans>
          )}
        </p>
      </fieldset>

      {linked && columns && (
        <fieldset className="flex flex-col gap-2">
          <legend className={sectionTitle}>
            <Trans>연결 컬럼</Trans>
          </legend>
          <p className="text-2xs text-fg-muted">
            <Trans>
              데이터가 달라, 따를 칸에서 고른 행의 값과 이 칸의 컬럼 값이 같은
              행을 따릅니다.
            </Trans>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Select
              label={t`따를 칸 컬럼`}
              value={columns.value?.source ?? null}
              placeholder={t`고르기`}
              options={columns.source}
              onChange={(source) =>
                columns.onChange({
                  source,
                  // 이 칸에 같은 이름의 컬럼이 있으면 함께 맞춘다.
                  target: columns.target.some((o) => o.value === source)
                    ? source
                    : (columns.value?.target ?? source),
                })
              }
            />
            <Select
              label={t`이 칸 컬럼`}
              value={columns.value?.target ?? null}
              placeholder={t`고르기`}
              options={columns.target}
              onChange={(target) =>
                columns.onChange({
                  source: columns.value?.source ?? target,
                  target,
                })
              }
            />
          </div>
        </fieldset>
      )}

      {linked && (status || error) && (
        <div className="flex flex-col gap-1 rounded-md bg-panel px-2 py-1.5 text-xs">
          {status && <p className="text-fg-secondary">{status}</p>}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className={button({ size: "sm", class: "self-start" })}
        disabled={!linked}
        onClick={onUnlink}
      >
        <Unlink size={13} aria-hidden="true" />
        <Trans>연결 풀기</Trans>
      </button>
    </div>
  );
}
