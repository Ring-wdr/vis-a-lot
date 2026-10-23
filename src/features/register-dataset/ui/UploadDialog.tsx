"use client";

// 업로드(파일 열기) 팝업. 파일을 서버에 올려 두고(staging), 앞부분 미리보기로 전처리 옵션과 컬럼별
// 포함·타입을 정한 뒤 확인을 누르면 적재한다. 적재 진행은 long polling으로 받고, 끝나면 새 데이터셋 id로 닫는다.
// 데이터스토어의 '수정'도 같은 팝업을 쓴다 (보관해 둔 원본을 다시 올려 둔다).

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
import { useCallbackRef } from "@/shared/lib/use-callback-ref";
import { useDebounced } from "@/shared/lib/use-debounced";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { EmptyState, LoadingText, Spinner } from "@/shared/ui/Loading";
import { type GridColumn, PreviewGrid } from "./PreviewGrid";
import styles from "./UploadDialog.module.css";
import { DEFAULT_CSV_OPTIONS, UploadOptions } from "./UploadOptions";

const ACCEPT = ".csv,.tsv,.txt,.zip";
const PREVIEW_DEBOUNCE_MS = 300;

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

const RUNNING: UploadTask["state"][] = ["parse", "queued", "copy", "analyze"];

/** 적재 진행 한 줄 */
function TaskProgress({ task }: { task: UploadTask }) {
  const ratio = task.total > 0 ? task.done / task.total : 0;
  const label = {
    parse: `검사·변환 중 ${Math.round(ratio * 100)}%`,
    queued: "다른 적재가 끝나기를 기다리는 중",
    copy: `적재 중 ${task.done.toLocaleString()} / ${task.total.toLocaleString()}행`,
    analyze: "컬럼 통계 계산 중",
    done: "완료",
    rejected: "거절됨",
    failed: "실패",
  }[task.state];
  return (
    <output className={styles.progress}>
      <progress
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
    changed(id);
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
    <section className={styles.body} aria-labelledby={titleId}>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {dataset ? "데이터 수정" : "파일 열기"}
        </h2>
        <div className={styles.headActions}>
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
              dataset ? "수정에서는 원본 파일을 바꿀 수 없습니다" : undefined
            }
            onClick={() => fileInput.current?.click()}
          >
            {stage.isPending ? (
              <Spinner size="sm" tone="inherit" />
            ) : (
              <FolderOpen size={14} aria-hidden="true" />
            )}
            파일 선택
          </button>
          <button
            type="button"
            className={button()}
            disabled={!stageId || check.isPending || running}
            title="적재하지 않고 파일 전체를 검사합니다"
            onClick={() => check.mutate(options)}
          >
            {check.isPending ? (
              <Spinner size="sm" tone="inherit" />
            ) : (
              <CheckCheck size={14} aria-hidden="true" />
            )}
            검사
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <section className={styles.files} aria-label="파일">
          <table className={styles.fileTable}>
            <thead>
              <tr>
                <th>번호</th>
                <th>이름</th>
              </tr>
            </thead>
            <tbody>
              {staged?.files.map((f, i) => (
                <tr key={f.name} aria-selected={i === fileIndex}>
                  <td>{i}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.fileButton}
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
            <p className={styles.hint}>
              {staged.fileName} · {formatBytes(staged.size)}
              {staged.files.length > 1 &&
                ` · CSV ${staged.files.length}개를 하나로 합칩니다`}
            </p>
          )}
        </section>

        {/* 원본 앞부분. 파일을 끌어다 놓아도 올린다. */}
        <section
          className={styles.raw}
          aria-label="원본"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files[0]);
          }}
        >
          {preview.data ? (
            <pre>{preview.data.raw.join("\n")}</pre>
          ) : staging || preview.isFetching ? (
            <LoadingText>불러오는 중</LoadingText>
          ) : (
            <EmptyState
              size="sm"
              icon={<FileUp size={20} />}
              title="파일을 선택하세요"
            >
              CSV 또는 CSV를 묶은 zip. 여기로 끌어다 놓아도 됩니다.
            </EmptyState>
          )}
        </section>

        <aside className={styles.optionsPane} aria-label="전처리 옵션">
          <fieldset disabled={running} className={styles.plainFieldset}>
            <UploadOptions
              name={name}
              onNameChange={setName}
              value={options}
              onChange={setOption}
            />
          </fieldset>
        </aside>

        <section className={styles.previewPane} aria-label="미리보기">
          {preview.data?.error ? (
            <p role="alert" className={styles.error}>
              {preview.data.error}
            </p>
          ) : preview.data ? (
            <fieldset disabled={running} className={styles.plainFieldset}>
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

      <footer className={styles.foot}>
        <div className={styles.status}>
          {task && RUNNING.includes(task.state) ? (
            <TaskProgress task={task} />
          ) : failure ? (
            <p role="alert" className={styles.error}>
              {failure}
            </p>
          ) : checkResult ? (
            <output className={styles.checkOk}>
              검사 통과 · {checkResult.rows.toLocaleString()}행
              {checkResult.skipped > 0 &&
                ` · 건너뛴 행 ${checkResult.skipped.toLocaleString()}개`}
              {checkResult.columns.some((c) => c.invalid > 0) &&
                " · 변환 불가 값은 null로 넣습니다"}
            </output>
          ) : preview.data && !preview.data.error ? (
            <p className={styles.hint}>
              앞 {preview.data.rows.length}행 미리보기입니다. 검사를 누르면 파일
              전체를 확인합니다.
            </p>
          ) : null}
        </div>
        <div className={dialogActions}>
          <button type="button" className={button()} onClick={onCancel}>
            취소
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
            {dataset ? "다시 적재" : "확인"}
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
        className={styles.dialog}
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
