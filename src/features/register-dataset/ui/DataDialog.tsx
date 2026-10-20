"use client";

import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import { COLUMN_TYPE_LABELS, ROW_LABELS } from "@/entities/dataset/lib/labels";
import {
  useColumns,
  useDatasets,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetStatus, RowSize } from "@/shared/api/types";
import { ROW_SIZES } from "@/shared/config/dataset";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import styles from "./DataDialog.module.css";

function StatusCell({ status }: { status: DatasetStatus | undefined }) {
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
 * 등록한 규모만 왼쪽 패널에서 고를 수 있다.
 */
function DataDialogBody({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const [picked, setPicked] = useState<RowSize>();
  const statusOf = (rows: RowSize) =>
    datasets.data?.datasets.find((d) => d.rows === rows);
  const pickedReady =
    picked !== undefined && statusOf(picked)?.state === "ready";
  const columns = useColumns(picked ?? ROW_SIZES[0], pickedReady);

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
                  <StatusCell status={status} />
                </td>
                <td className={styles.action}>
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
                      onClick={() =>
                        setPicked(picked === rows ? undefined : rows)
                      }
                    >
                      컬럼
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
                <td className={styles.number}>{c.distinct.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={dialogStyles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          닫기
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
