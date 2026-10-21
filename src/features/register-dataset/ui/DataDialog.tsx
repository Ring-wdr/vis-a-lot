"use client";

import { FileUp } from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import {
  COLUMN_TYPE_LABELS,
  delimiterLabel,
} from "@/entities/dataset/lib/labels";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { TABS_LOCKED_HINT } from "@/entities/workspace/model/tabs-store";
import {
  useDatasetSchema,
  useDatasets,
  useDeleteDataset,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetId, DatasetStatus } from "@/shared/api/types";
import { DEFAULT_DATASET } from "@/shared/config/dataset";
import { formatBytes } from "@/shared/lib/format";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import {
  EmptyState,
  LoadingText,
  Skeleton,
  Spinner,
} from "@/shared/ui/Loading";
import styles from "./DataDialog.module.css";

/** 업로드·수정 팝업은 처음 열 때 불러온다. */
const loadUploadDialog = () => import("./UploadDialog");

/** 등록 시간: 2026-10-21 13:18 */
function registeredAt(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function StatusCell({
  status,
  loading,
}: {
  status: DatasetStatus | undefined;
  /** 목록을 받는 중이면 등록 여부를 아직 모른다. */
  loading: boolean;
}) {
  if (loading) return <Skeleton width={50} />;
  if (!status || status.state === "missing") {
    return <span className={styles.muted}>미등록</span>;
  }
  if (status.state === "failed") {
    return (
      <span className={styles.failed} title={status.error}>
        실패
      </span>
    );
  }
  if (status.state === "generating") {
    return (
      <span className={styles.progress}>
        <progress value={status.done} max={Math.max(1, status.total)} />
        {status.phase === "analyze"
          ? "컬럼 통계 계산 중"
          : `${Math.round((status.done / Math.max(1, status.total)) * 100)}%`}
      </span>
    );
  }
  return (
    <span>
      준비됨
      {status.generateMs !== undefined &&
        ` · ${(status.generateMs / 1000).toFixed(1)}초`}
    </span>
  );
}

/**
 * data 팝업. 샘플(시드로 만드는 IoT 센서 데이터)을 등록하거나, CSV·zip을 올려 브라우저 DB(PGlite)에 적재한다.
 * 준비된 데이터를 선택하고 'gallery에서 열기'를 누르면 그 데이터로 새 gallery 탭을 연다.
 */
function DataDialogBody({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const openGallery = useTabs((s) => s.openGallery);
  const locked = useTabs((s) => s.locked);
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const remove = useDeleteDataset();
  const [picked, setPicked] = useState<DatasetId>();
  const [opening, setOpening] = useState(false);
  const list = datasets.data?.datasets ?? [];
  const samples = list.filter((d) => d.kind === "sample");
  const uploads = list.filter((d) => d.kind === "upload");
  const pickedStatus = list.find((d) => d.id === picked);
  const pickedReady = pickedStatus?.state === "ready";
  const pickedUpload =
    pickedStatus?.kind === "upload" && pickedStatus.upload
      ? { ...pickedStatus, upload: pickedStatus.upload }
      : undefined;
  const uploadBusy = pickedUpload?.state === "generating";
  const columns = useDatasetSchema(picked ?? DEFAULT_DATASET);

  /** 팝업 모듈을 불러오는 동안 버튼을 막는다. */
  async function withUploadDialog<T>(
    open: (mod: Awaited<ReturnType<typeof loadUploadDialog>>) => T,
  ) {
    setOpening(true);
    try {
      return open(await loadUploadDialog());
    } finally {
      setOpening(false);
    }
  }

  const upload = async () => {
    const id = await withUploadDialog((mod) => mod.openUploadDialog());
    if (id) setPicked(id);
  };

  const editPicked = () => {
    if (pickedUpload)
      withUploadDialog((mod) => mod.openEditDialog(pickedUpload));
  };

  const deletePicked = async () => {
    if (!pickedUpload) return;
    const ok = await showConfirm(
      `'${pickedUpload.name}'을 삭제할까요? 이 데이터로 그린 탭은 다시 그릴 수 없게 됩니다.`,
      { confirmLabel: "삭제" },
    );
    if (!ok) return;
    remove.mutate(pickedUpload.id, {
      onSuccess: () => setPicked(undefined),
      onError: (err) => showAlert(err.message),
    });
  };

  return (
    <div className={styles.body}>
      <h2 id={titleId} className={styles.title}>
        데이터
      </h2>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>샘플 데이터</h3>
        <p className={styles.muted}>
          제조 IoT 센서 데이터셋(mock)입니다. 등록하면 브라우저 안의 서버가
          시드로 데이터를 만들어 저장합니다.
        </p>
        <table className={styles.table}>
          <colgroup>
            <col className={styles.colSize} />
            <col />
            <col className={styles.colAction} />
          </colgroup>
          <thead>
            <tr>
              <th>규모</th>
              <th>상태</th>
              <th aria-label="동작" />
            </tr>
          </thead>
          <tbody>
            {datasets.isPending && (
              <tr>
                <td colSpan={3}>
                  <Skeleton width={90} />
                </td>
              </tr>
            )}
            {samples.map((status) => (
              <tr
                key={status.id}
                aria-selected={picked === status.id || undefined}
              >
                <td>{status.name}</td>
                <td>
                  <StatusCell status={status} loading={false} />
                </td>
                <td className={styles.action}>
                  {/* 적재 중에도 버튼 자리를 남겨 행 높이가 바뀌지 않게 한다. */}
                  {status.state === "generating" && (
                    <button
                      type="button"
                      className={dialogStyles.primary}
                      disabled
                    >
                      <Spinner size="sm" tone="inherit" />
                      등록 중
                    </button>
                  )}
                  {status.state === "missing" && (
                    <button
                      type="button"
                      className={dialogStyles.primary}
                      disabled={generate.isPending}
                      onClick={() => {
                        generate.mutate(status.id);
                        setPicked(status.id);
                      }}
                    >
                      등록
                    </button>
                  )}
                  {status.state === "ready" && (
                    <button
                      type="button"
                      className={styles.secondary}
                      aria-pressed={picked === status.id}
                      onClick={() => setPicked(status.id)}
                    >
                      {picked === status.id ? "선택됨" : "선택"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>업로드한 파일</h3>
          <div className={styles.toolbar}>
            <button
              type="button"
              className={styles.secondary}
              disabled={!pickedUpload || uploadBusy || opening}
              title={uploadBusy ? "적재 중에는 수정할 수 없습니다" : undefined}
              onClick={editPicked}
            >
              수정
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={!pickedUpload || uploadBusy || remove.isPending}
              title={uploadBusy ? "적재 중에는 지울 수 없습니다" : undefined}
              onClick={deletePicked}
            >
              삭제
            </button>
            <button
              type="button"
              className={dialogStyles.primary}
              disabled={opening}
              onClick={upload}
            >
              {opening && <Spinner size="sm" tone="inherit" />}
              업로드
            </button>
          </div>
        </div>
        <div className={styles.scroll}>
          <table className={`${styles.table} ${styles.files}`}>
            <colgroup>
              <col />
              <col className={styles.colBytes} />
              <col className={styles.colTime} />
              <col className={styles.colDelimiter} />
              <col className={styles.colHeader} />
              <col className={styles.colNull} />
              <col className={styles.colState} />
            </colgroup>
            <thead>
              <tr>
                <th>이름</th>
                <th className={styles.number}>크기</th>
                <th>등록 시간</th>
                <th>구분 기호</th>
                <th>첫 번째 행 헤더</th>
                <th>Null 값</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((status) => {
                const info = status.upload;
                return (
                  <tr
                    key={status.id}
                    aria-selected={picked === status.id || undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className={styles.rowButton}
                        aria-pressed={picked === status.id}
                        title={info?.fileName}
                        onClick={() => setPicked(status.id)}
                      >
                        {status.name}
                      </button>
                      {info && info.files.length > 1 && (
                        <span className={styles.muted}>
                          {" "}
                          CSV {info.files.length}개
                        </span>
                      )}
                    </td>
                    <td className={styles.number} title={`${info?.size} B`}>
                      {info ? formatBytes(info.size) : "–"}
                    </td>
                    <td>{info ? registeredAt(info.createdAt) : "–"}</td>
                    <td>
                      {info ? delimiterLabel(info.options.delimiter) : "–"}
                    </td>
                    <td>{info?.options.header ? "예" : "아니오"}</td>
                    <td>
                      {info?.options.nullValue ? (
                        <code>{info.options.nullValue}</code>
                      ) : (
                        <span className={styles.muted}>(빈 값)</span>
                      )}
                    </td>
                    <td>
                      <StatusCell status={status} loading={false} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {datasets.data && uploads.length === 0 && (
            <EmptyState
              size="sm"
              icon={<FileUp size={20} />}
              title="올린 파일이 없습니다"
            >
              CSV 또는 CSV를 묶은 zip을 업로드하세요.
            </EmptyState>
          )}
        </div>
        {pickedStatus?.state === "failed" && pickedStatus.error && (
          <p role="alert" className={styles.error}>
            {pickedStatus.error}
          </p>
        )}
      </section>

      {datasets.error && <p role="alert">{datasets.error.message}</p>}
      {generate.error && <p role="alert">{generate.error.message}</p>}

      {pickedReady && columns.isPending && (
        <LoadingText>컬럼 불러오는 중</LoadingText>
      )}
      {pickedReady && columns.data && (
        <div className={styles.columns}>
          <table className={styles.table}>
            <caption>{pickedStatus.name} 컬럼</caption>
            <thead>
              <tr>
                <th>컬럼</th>
                <th>타입</th>
                <th className={styles.number}>고유값</th>
              </tr>
            </thead>
            <tbody>
              {columns.data.columns.map((c) => (
                <tr key={c.name}>
                  <td title={c.name}>{c.label}</td>
                  <td>{COLUMN_TYPE_LABELS[c.type]}</td>
                  <td className={styles.number}>
                    {c.distinct?.toLocaleString() ?? "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={dialogStyles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          닫기
        </button>
        <button
          type="button"
          className={dialogStyles.primary}
          disabled={!pickedReady || locked}
          title={
            locked
              ? TABS_LOCKED_HINT
              : pickedReady
                ? undefined
                : "준비된 데이터를 선택하세요"
          }
          onClick={() => {
            if (picked === undefined) return;
            // 고른 데이터로 새 gallery 탭(작업 공간)을 연다.
            openGallery({ dataset: picked });
            onClose();
          }}
        >
          gallery에서 열기
        </button>
      </div>
    </div>
  );
}

/** data 팝업을 띄운다. 등록·적재 진행은 팝업을 닫아도 서버에서 이어진다. */
export function openDataDialog() {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={styles.dialog}
    >
      <DataDialogBody onClose={close} />
    </Dialog>
  ));
}
