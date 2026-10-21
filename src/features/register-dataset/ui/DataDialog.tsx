"use client";

import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import { COLUMN_TYPE_LABELS, ROW_LABELS } from "@/entities/dataset/lib/labels";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { TABS_LOCKED_HINT } from "@/entities/workspace/model/tabs-store";
import {
  useDatasetSchema,
  useDatasets,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetStatus, RowSize } from "@/shared/api/types";
import { ROW_SIZES } from "@/shared/config/dataset";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import { LoadingText, Skeleton, Spinner } from "@/shared/ui/Loading";
import styles from "./DataDialog.module.css";

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
  if (status.state === "generating") {
    return (
      <span className={styles.progress}>
        <progress value={status.done} max={status.total} />
        {status.phase === "analyze"
          ? "컬럼 통계 계산 중"
          : `${Math.round((status.done / status.total) * 100)}%`}
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
 * 데이터 등록 팝업. 실제 업로드 대신 mock 서버가 시드로 IoT 센서 데이터를 만들어 브라우저 DB(PGlite)에 적재한다.
 * 준비된 데이터를 선택하고 'gallery에서 열기'를 누르면 그 데이터로 새 gallery 탭을 연다.
 */
function DataDialogBody({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const openGallery = useTabs((s) => s.openGallery);
  const locked = useTabs((s) => s.locked);
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const [picked, setPicked] = useState<RowSize>();
  const statusOf = (rows: RowSize) =>
    datasets.data?.datasets.find((d) => d.rows === rows);
  const pickedReady =
    picked !== undefined && statusOf(picked)?.state === "ready";
  const columns = useDatasetSchema(picked ?? ROW_SIZES[0]);

  return (
    <div className={styles.body}>
      <h2 id={titleId} className={styles.title}>
        데이터 등록
      </h2>
      <p className={styles.muted}>
        제조 IoT 센서 데이터셋(mock)입니다. 등록하면 브라우저 안의 서버가 시드로
        데이터를 만들어 저장합니다. 한 번 등록한 규모는 새로고침해도 남아
        있습니다.
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
          {ROW_SIZES.map((rows) => {
            const status = statusOf(rows);
            const state = status?.state ?? "missing";
            return (
              <tr key={rows} aria-selected={picked === rows || undefined}>
                <td>{ROW_LABELS[rows]}</td>
                <td>
                  <StatusCell status={status} loading={datasets.isPending} />
                </td>
                <td className={styles.action}>
                  {/* 적재 중에도 버튼 자리를 남겨 행 높이가 바뀌지 않게 한다. */}
                  {state === "generating" && (
                    <button
                      type="button"
                      className={dialogStyles.primary}
                      disabled
                    >
                      <Spinner size="sm" tone="inherit" />
                      등록 중
                    </button>
                  )}
                  {state === "missing" && (
                    <button
                      type="button"
                      className={dialogStyles.primary}
                      disabled={generate.isPending || !datasets.data}
                      onClick={() => {
                        generate.mutate(rows);
                        setPicked(rows);
                      }}
                    >
                      등록
                    </button>
                  )}
                  {state === "ready" && (
                    <button
                      type="button"
                      className={styles.secondary}
                      aria-pressed={picked === rows}
                      onClick={() => setPicked(rows)}
                    >
                      {picked === rows ? "선택됨" : "선택"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {datasets.error && <p role="alert">{datasets.error.message}</p>}
      {generate.error && <p role="alert">{generate.error.message}</p>}

      {pickedReady && columns.isPending && (
        <LoadingText>컬럼 불러오는 중</LoadingText>
      )}
      {pickedReady && columns.data && (
        <table className={styles.table}>
          <caption>{ROW_LABELS[columns.data.rows]} 컬럼</caption>
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
            openGallery({ rows: picked });
            onClose();
          }}
        >
          gallery에서 열기
        </button>
      </div>
    </div>
  );
}

/** data 팝업을 띄운다. 등록 진행은 팝업을 닫아도 서버에서 이어진다. */
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
