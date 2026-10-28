"use client";

import { useMutation } from "@tanstack/react-query";
import { Grid3x3 } from "lucide-react";
import { useState } from "react";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import {
  useWorkspace,
  useWorkspaceMutating,
  useWorkspaceMutationKey,
} from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { useJobProgress } from "@/shared/api/queries";
import { type ChartSpec, isTerminal } from "@/shared/api/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { showAlert } from "@/shared/ui/AlertDialog";
import { Popover } from "@/shared/ui/Popover";
import { selectStyles } from "@/shared/ui/select-styles";

const messages = defineMessages({
  ko: {
    rendering:
      "렌더링 중에는 grid 크기를 바꿀 수 없습니다. 끝나거나 취소한 뒤에 바꿔 주세요.",
    cell: (rows: number, cols: number) => `${rows}행 ${cols}열`,
    size: (rows: number, cols: number) => `${rows}행 × ${cols}열`,
    current: (grid: string) => ` (현재 ${grid})`,
  },
  en: {
    rendering:
      "The grid size can't change while rendering. Change it after it finishes or is cancelled.",
    cell: (rows: number, cols: number) => `${rows} rows, ${cols} columns`,
    size: (rows: number, cols: number) => `${rows} rows × ${cols} cols`,
    current: (grid: string) => ` (now ${grid})`,
  },
});

const s = selectStyles();

const MAX = 10;
const CELLS = Array.from({ length: MAX * MAX }, (_, i) => ({
  row: Math.floor(i / MAX),
  col: i % MAX,
}));

type Grid = ChartSpec["grid"];

const sameGrid = (a: Grid, b: Grid) => a.rows === b.rows && a.cols === b.cols;
const gridLabel = ({ rows, cols }: Grid) => `${rows} × ${cols}`;

/**
 * grid 크기(행 × 열). Excel의 표 삽입처럼 칸 위에 올리면 크기가 미리 보이고, 누르면 정해진다.
 * 그린 차트가 있으면 draw 없이 바로 전체를 다시 그리고, 렌더링 중에는 바꿀 수 없어 팝업으로 알린다.
 */
export function GridPicker() {
  const text = useT(messages);
  const draft = useWorkspace((s) => s.draft);
  const current = useWorkspace((s) => s.current);
  const page = useWorkspace((s) => s.page);
  const gridArea = useWorkspace((s) => s.gridArea);
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const replaceJob = useWorkspace((s) => s.replaceJob);
  const notify = useWorkspace((s) => s.notify);
  const [hover, setHover] = useState<Grid>();
  const grid = current?.spec.grid;
  const pageSize = grid ? grid.rows * grid.cols : 1;
  const job = useJobProgress(current?.jobId);

  const change = useMutation({
    mutationKey: useWorkspaceMutationKey("grid"),
    mutationFn: (next: Grid) => {
      if (!current || !gridArea) throw new Error("no chart");
      return api.changeGrid(current.chartId, next, itemSizeFor(gridArea, next));
    },
    onSuccess: ({ jobId }, next) => {
      if (!current) return;
      // 보던 첫 item이 새 페이지 크기에서도 보이도록 페이지를 맞춘다.
      const firstItem = page * pageSize;
      replaceJob(
        jobId,
        { ...current.spec, grid: next },
        Math.floor(firstItem / (next.rows * next.cols)),
      );
    },
    onError: (err) => {
      notify(err.message);
      if (current) updateDraft({ grid: current.spec.grid });
    },
  });

  const changing = useWorkspaceMutating("grid");
  const rendering =
    current !== undefined && (!job.data || !isTerminal(job.data.status));
  const selected = draft.grid;
  const preview = hover ?? selected;

  const pick = (next: Grid) => {
    if (current && rendering) {
      showAlert(text.rendering);
      return;
    }
    updateDraft({ grid: next });
    if (current && !sameGrid(next, current.spec.grid)) change.mutate(next);
  };

  return (
    <div className={s.field()}>
      <span className={s.label()}>Grid</span>
      <Popover
        triggerClassName={s.trigger()}
        disabled={readOnly || changing}
        width={MAX * 20 + 24}
        trigger={
          <>
            <Grid3x3 size={14} aria-hidden="true" />
            <span className={s.value()}>{gridLabel(selected)}</span>
          </>
        }
      >
        {(close) => (
          <div className="flex flex-col gap-2">
            <div
              // 10 x 10 칸 (MAX)
              className="grid grid-cols-10 gap-0.5"
              onPointerLeave={() => setHover(undefined)}
            >
              {CELLS.map(({ row, col }) => {
                const cell = { rows: row + 1, cols: col + 1 };
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className="aspect-square cursor-pointer rounded-xs border border-line bg-elevated focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent data-active:border-accent data-active:bg-accent-soft data-selected:not-data-active:border-accent-line"
                    aria-label={text.cell(cell.rows, cell.cols)}
                    data-active={
                      (row < preview.rows && col < preview.cols) || undefined
                    }
                    data-selected={
                      (row < selected.rows && col < selected.cols) || undefined
                    }
                    onPointerEnter={() => setHover(cell)}
                    onFocus={() => setHover(cell)}
                    onClick={() => {
                      pick(cell);
                      setHover(undefined);
                      close();
                    }}
                  />
                );
              })}
            </div>
            <span
              className="text-center text-xs text-fg-secondary"
              aria-live="polite"
            >
              {text.size(preview.rows, preview.cols)}
              {!sameGrid(preview, selected) &&
                text.current(gridLabel(selected))}
            </span>
          </div>
        )}
      </Popover>
    </div>
  );
}
