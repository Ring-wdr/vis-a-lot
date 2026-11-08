"use client";

// 업로드(파일 열기) 팝업. 파일을 서버에 올려 두고(staging), 앞부분 미리보기로 전처리 옵션과 컬럼별
// 포함·타입을 정한 뒤 확인을 누르면 적재한다. 적재 진행은 long polling으로 받고, 끝나면 새 데이터셋 id로 닫는다.
// 데이터스토어의 '수정'도 같은 팝업을 쓴다 (보관해 둔 원본을 다시 올려 둔다).

import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { CheckCheck, FileUp, FolderOpen } from "lucide-react";
import { overlay } from "overlay-kit";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/shared/api/api";
import {
  useDatasetChanged,
  useUploadPreview,
  useUploadTask,
} from "@/shared/api/queries";
import type {
  ColumnType,
  CsvCheck,
  CsvOptions,
  DatasetId,
  StagedUpload,
  UploadTask,
} from "@/shared/api/types";
import { formatBytes } from "@/shared/lib/format";
import { intlLocale } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { useDebounced } from "@/shared/lib/use-debounced";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { EmptyState, LoadingText, Spinner } from "@/shared/ui/Loading";
import "../config/messages";
import { type GridColumn, PreviewGrid } from "./PreviewGrid";
import { DEFAULT_CSV_OPTIONS, UploadOptions } from "./UploadOptions";

const ACCEPT = ".csv,.tsv,.txt,.zip";
const PREVIEW_DEBOUNCE_MS = 300;

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

const RUNNING: UploadTask["state"][] = ["parse", "queued", "copy", "analyze"];

const error = "m-0 whitespace-pre-wrap text-ui text-danger";
const hint = "m-0 text-2xs text-fg-muted leading-normal";
const pane = "min-h-0 min-w-0 rounded-md border border-line bg-surface";
// 비활성화(적재 중)만 묶고 모양은 없는 fieldset
const plainFieldset = "flex min-h-0 min-w-0 flex-1 flex-col";
const fileCell = "border-line border-b px-2 py-1 text-left";

/** 적재 진행 한 줄 */
function TaskProgress({ task }: { task: UploadTask }) {
  const { t } = useLingui();
  const locale = intlLocale();
  const ratio = task.total > 0 ? task.done / task.total : 0;
  const percent = Math.round(ratio * 100);
  const done = task.done.toLocaleString(locale);
  const total = task.total.toLocaleString(locale);
  const label = {
    parse: t`검사·변환 중 ${percent}%`,
    queued: t`다른 적재가 끝나기를 기다리는 중`,
    copy: t`적재 중 ${done} / ${total}행`,
    analyze: t`컬럼 통계 계산 중`,
    done: t({ message: "완료", context: "upload task" }),
    rejected: t({ message: "거절됨", context: "upload task" }),
    failed: t({ message: "실패", context: "upload task" }),
  }[task.state];
  return (
    <output className="flex items-center gap-2.5 text-ui text-fg-secondary">
      <progress
        className="w-60"
        value={
          task.state === "analyze" || task.state === "queued"
            ? undefined
            : ratio
        }
      />
      <span>{label}</span>
    </output>
  );
}

function UploadBody({
  dataset,
  onDone,
  onCancel,
}: {
  /** 수정이면 다시 적재할 데이터셋 */
  dataset?: DatasetId;
  onDone: (id: DatasetId) => void;
  onCancel: () => void;
}) {
  const { t } = useLingui();
  const locale = intlLocale();
  const mergeNote = (n: number) =>
    t({
      message: `CSV ${n}개를 하나로 합칩니다`,
      comment: "n: zip 안의 CSV 수",
    });
  const checkPassed = (count: number) => {
    const rows = count.toLocaleString(locale);
    return t`검사 통과 · ${rows}행`;
  };
  const skippedNote = (count: number) => {
    const skipped = count.toLocaleString(locale);
    return t`건너뛴 행 ${skipped}개`;
  };
  const previewHint = (n: number) =>
    t({
      message: `앞 ${n}행 미리보기입니다. 검사를 누르면 파일 전체를 확인합니다.`,
      comment: "n: 미리보기 행 수",
    });
  const titleId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<StagedUpload>();
  const [fileIndex, setFileIndex] = useState(0);
  const [name, setName] = useState("");
  const [options, setOptions] = useState<CsvOptions>(DEFAULT_CSV_OPTIONS);
  const [checked, setChecked] = useState<{
    options: CsvOptions;
    result: CsvCheck;
  }>();
  const [attempt, setAttempt] = useState(0);
  const changed = useDatasetChanged();
  const stageId = staged?.stageId;

  const stage = useMutation({
    mutationFn: (file: File) => api.stageUpload(file),
    onSuccess: (next, file) => {
      setStaged(next);
      setFileIndex(0);
      setName(baseName(file.name));
      setChecked(undefined);
    },
  });
  const restage = useMutation({
    mutationFn: (id: DatasetId) => api.stageDataset(id),
    onSuccess: (next) => {
      setStaged(next);
      if (next.dataset) {
        setName(next.dataset.name);
        setOptions(next.dataset.options);
      }
    },
  });
  const check = useMutation({
    mutationFn: (opts: CsvOptions) => api.checkUpload(stageId as string, opts),
    onSuccess: (result, opts) => setChecked({ options: opts, result }),
  });
  const commit = useMutation({
    mutationFn: () =>
      api.commitUpload(stageId as string, {
        name: name.trim() || baseName(staged?.fileName ?? "data"),
        options,
      }),
    onSuccess: () => setAttempt((n) => n + 1),
  });

  // 수정이면 보관해 둔 원본을 올려 둔다.
  const { mutate: restageMutate } = restage;
  useEffect(() => {
    if (dataset) restageMutate(dataset);
  }, [dataset, restageMutate]);

  // 올려 둔 파일은 팝업을 닫거나 다른 파일을 고르면 버린다.
  useEffect(() => {
    if (!stageId) return;
    return () => {
      api.discardStage(stageId).catch(() => undefined);
    };
  }, [stageId]);

  const previewOptions = useDebounced(options, PREVIEW_DEBOUNCE_MS);
  const preview = useUploadPreview(stageId, fileIndex, previewOptions);
  const task = useUploadTask(stageId, attempt).data;
  const running =
    commit.isPending || (task !== undefined && RUNNING.includes(task.state));

  // 적재가 끝나면 목록을 다시 받고 새 데이터셋으로 닫는다.
  const finished = task?.state === "done" ? task.datasetId : undefined;
  const finish = useCallbackRef((id: DatasetId) => {
    void changed(id);
    onDone(id);
  });
  useEffect(() => {
    if (finished) finish(finished);
  }, [finished, finish]);

  const setOption = (next: CsvOptions) => {
    setOptions(next);
    commit.reset();
    check.reset();
  };

  // 검사 결과는 같은 옵션일 때만 쓴다.
  const checkResult =
    checked && JSON.stringify(checked.options) === JSON.stringify(options)
      ? checked.result
      : undefined;
  const excluded = new Set(options.excluded);
  const columns: GridColumn[] = (preview.data?.columns ?? []).map((c) => {
    const full = checkResult?.columns.find((x) => x.name === c.name);
    return {
      name: c.name,
      inferred: full?.inferred ?? c.inferred,
      chosen: options.types?.[c.name],
      included: !excluded.has(c.name),
      invalid: full?.invalid,
    };
  });

  const setType = (column: string, type: ColumnType | undefined) => {
    const types = { ...options.types };
    if (type) types[column] = type;
    else delete types[column];
    setOption({ ...options, types });
  };
  const setIncluded = (names: string[], included: boolean) => {
    const next = new Set(options.excluded);
    for (const n of names) {
      if (included) next.delete(n);
      else next.add(n);
    }
    setOption({ ...options, excluded: [...next] });
  };

  const pickFile = (file: File | undefined) => {
    if (!file || dataset) return;
    commit.reset();
    stage.mutate(file);
  };

  const failure =
    stage.error?.message ??
    restage.error?.message ??
    check.error?.message ??
    commit.error?.message ??
    (task?.state === "rejected" || task?.state === "failed"
      ? task.error
      : undefined);
  const staging = stage.isPending || restage.isPending;

  return (
    <section
      className="flex h-full min-h-0 flex-col gap-3"
      aria-labelledby={titleId}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-bold">
          {dataset ? <Trans>데이터 수정</Trans> : <Trans>파일 열기</Trans>}
        </h2>
        <div className="flex gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={button({ variant: "primary" })}
            disabled={Boolean(dataset) || staging || running}
            title={
              dataset ? t`수정에서는 원본 파일을 바꿀 수 없습니다` : undefined
            }
            onClick={() => fileInput.current?.click()}
          >
            {stage.isPending ? (
              <Spinner size="sm" tone="inherit" />
            ) : (
              <FolderOpen size={14} aria-hidden="true" />
            )}
            <Trans>파일 선택</Trans>
          </button>
          <button
            type="button"
            className={button()}
            disabled={!stageId || check.isPending || running}
            title={t`적재하지 않고 파일 전체를 검사합니다`}
            onClick={() => check.mutate(options)}
          >
            {check.isPending ? (
              <Spinner size="sm" tone="inherit" />
            ) : (
              <CheckCheck size={14} aria-hidden="true" />
            )}
            <Trans context="check whole file button">검사</Trans>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[12.5rem_minmax(0,1fr)_16.25rem] grid-rows-[minmax(8.75rem,38%)_minmax(0,1fr)] gap-2.5 [grid-template-areas:'files_raw_options'_'preview_preview_options'] max-[53.75rem]:grid-cols-[minmax(0,1fr)] max-[53.75rem]:grid-rows-[auto_10rem_auto_minmax(15rem,1fr)] max-[53.75rem]:overflow-auto max-[53.75rem]:[grid-template-areas:'files'_'raw'_'options'_'preview']">
        <section
          className={cn(pane, "overflow-auto [grid-area:files]")}
          aria-label={t({ message: "파일", context: "uploaded files list" })}
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th
                  className={cn(
                    fileCell,
                    "sticky top-0 w-10 bg-panel font-semibold text-fg-muted",
                  )}
                >
                  <Trans context="file list header">번호</Trans>
                </th>
                <th
                  className={cn(
                    fileCell,
                    "sticky top-0 bg-panel font-semibold text-fg-secondary",
                  )}
                >
                  <Trans context="file list header">이름</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {staged?.files.map((f, i) => (
                <tr
                  key={f.name}
                  className="group"
                  aria-selected={i === fileIndex}
                >
                  <td
                    className={cn(
                      fileCell,
                      "w-10 text-fg-muted group-aria-selected:bg-accent-soft",
                    )}
                  >
                    {i}
                  </td>
                  <td
                    className={cn(
                      fileCell,
                      "group-aria-selected:bg-accent-soft",
                    )}
                  >
                    <button
                      type="button"
                      className="block max-w-32.5 cursor-pointer truncate text-left text-xs"
                      aria-pressed={i === fileIndex}
                      title={`${f.name} · ${formatBytes(f.size)}`}
                      onClick={() => setFileIndex(i)}
                    >
                      {f.name}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {staged && (
            <p className={cn(hint, "px-2 py-1.5")}>
              {staged.fileName} · {formatBytes(staged.size)}
              {staged.files.length > 1 &&
                ` · ${mergeNote(staged.files.length)}`}
            </p>
          )}
        </section>

        {/* 원본 앞부분. 파일을 끌어다 놓아도 올린다. */}
        <section
          className={cn(pane, "overflow-auto [grid-area:raw]")}
          aria-label={t({ message: "원본", context: "raw file preview" })}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files[0]);
          }}
        >
          {preview.data ? (
            <pre className="m-0 px-2.5 py-2 font-code text-xs leading-relaxed whitespace-pre">
              {preview.data.raw.join("\n")}
            </pre>
          ) : staging || preview.isFetching ? (
            <LoadingText>
              <Trans context="raw file preview">불러오는 중</Trans>
            </LoadingText>
          ) : (
            <EmptyState
              size="sm"
              icon={<FileUp size={20} />}
              title={t`파일을 선택하세요`}
            >
              <Trans>
                CSV 또는 CSV를 묶은 zip. 여기로 끌어다 놓아도 됩니다.
              </Trans>
            </EmptyState>
          )}
        </section>

        <aside
          className={cn(pane, "overflow-auto p-3 [grid-area:options]")}
          aria-label={t`전처리 옵션`}
        >
          <fieldset disabled={running} className={plainFieldset}>
            <UploadOptions
              name={name}
              onNameChange={setName}
              value={options}
              onChange={setOption}
            />
          </fieldset>
        </aside>

        <section
          className={cn(
            pane,
            "flex flex-col overflow-hidden [grid-area:preview]",
          )}
          aria-label={t`미리보기`}
        >
          {preview.data?.error ? (
            <p role="alert" className={cn(error, "p-3")}>
              {preview.data.error}
            </p>
          ) : preview.data ? (
            <fieldset disabled={running} className={plainFieldset}>
              <PreviewGrid
                columns={columns}
                preview={preview.data}
                onInclude={(column, included) =>
                  setIncluded([column], included)
                }
                onIncludeAll={(included) =>
                  setIncluded(
                    columns.map((c) => c.name),
                    included,
                  )
                }
                onType={setType}
              />
            </fieldset>
          ) : null}
        </section>
      </div>

      <footer className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {task && RUNNING.includes(task.state) ? (
            <TaskProgress task={task} />
          ) : failure ? (
            <p role="alert" className={error}>
              {failure}
            </p>
          ) : checkResult ? (
            <output className="m-0 block text-ui text-fg-secondary">
              {checkPassed(checkResult.rows)}
              {checkResult.skipped > 0 &&
                ` · ${skippedNote(checkResult.skipped)}`}
              {checkResult.columns.some((c) => c.invalid > 0) &&
                ` · ${t`변환 불가 값은 null로 넣습니다`}`}
            </output>
          ) : preview.data && !preview.data.error ? (
            <p className={hint}>{previewHint(preview.data.rows.length)}</p>
          ) : null}
        </div>
        <div className={cn(dialogActions, "mt-0")}>
          <button type="button" className={button()} onClick={onCancel}>
            <Trans context="upload dialog">취소</Trans>
          </button>
          <button
            type="button"
            className={button({ variant: "primary" })}
            disabled={
              !stageId ||
              running ||
              !options.delimiter ||
              !options.quote ||
              Boolean(preview.data?.error)
            }
            onClick={() => commit.mutate()}
          >
            {running && <Spinner size="sm" tone="inherit" />}
            {dataset ? (
              <Trans>다시 적재</Trans>
            ) : (
              <Trans context="upload dialog">확인</Trans>
            )}
          </button>
        </div>
      </footer>
    </section>
  );
}

/**
 * 업로드 팝업. 적재가 끝나면 그 데이터셋 id로, 취소하면 undefined로 끝난다.
 * dataset을 주면 그 데이터셋을 보관한 원본으로 다시 적재하는 수정 팝업이 된다.
 */
export function openUploadDialog(dataset?: DatasetId) {
  return overlay.openAsync<DatasetId | undefined>(
    ({ isOpen, close, unmount }) => (
      <Dialog
        isOpen={isOpen}
        onClose={() => close(undefined)}
        onExited={unmount}
        // 파일 열기 팝업: 위에 파일 목록·원본·옵션, 아래에 미리보기 표. 미리보기가 바뀌어도 팝업 크기가 흔들리지 않게
        // 팝업 크기를 화면에 맞춰 정해 두고, 각 칸 안에서 스크롤한다.
        className="h-[min(51.25rem,calc(100dvh-12vh-1.5rem))] w-[min(73.75rem,calc(100vw-2rem))] max-w-none overflow-hidden px-5 py-4"
      >
        <UploadBody
          dataset={dataset}
          onDone={close}
          onCancel={() => close(undefined)}
        />
      </Dialog>
    ),
  );
}
