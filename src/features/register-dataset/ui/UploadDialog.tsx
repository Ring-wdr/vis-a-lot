"use client";

// 업로드·수정 팝업. data 팝업에서 버튼을 누를 때 동적 import로 불러온다.

import { overlay } from "overlay-kit";
import { type FormEvent, useId, useState } from "react";
import { COLUMN_TYPE_LABELS } from "@/entities/dataset/lib/labels";
import { useEditDataset, useUploadDataset } from "@/shared/api/queries";
import type {
  ColumnType,
  CsvOptions,
  DatasetId,
  DatasetStatus,
} from "@/shared/api/types";
import { formatBytes } from "@/shared/lib/format";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import { Spinner } from "@/shared/ui/Loading";
import {
  CsvOptionsFields,
  DEFAULT_CSV_OPTIONS,
  sameShape,
} from "./CsvOptionsFields";
import styles from "./UploadDialog.module.css";

const ACCEPT = ".csv,.tsv,.txt,.zip";

const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, "");

function UploadBody({
  onDone,
  onCancel,
}: {
  onDone: (id: DatasetId) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const fileId = useId();
  const nameId = useId();
  const [file, setFile] = useState<File>();
  const [name, setName] = useState("");
  const [options, setOptions] = useState<CsvOptions>(DEFAULT_CSV_OPTIONS);
  const upload = useUploadDataset();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    upload.mutate(
      { file, name: name.trim() || baseName(file.name), options },
      { onSuccess: (status) => onDone(status.id) },
    );
  };

  return (
    <form className={styles.body} onSubmit={submit} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        파일 업로드
      </h2>
      <p className={styles.muted}>
        CSV 파일 하나 또는 CSV를 묶은 zip을 올립니다. zip 안의 CSV는 하나의
        데이터로 합치므로 컬럼 수·이름·타입이 모두 같아야 하고, 하나라도 다르면
        전체를 거절합니다.
      </p>

      <div className={styles.field}>
        <label htmlFor={fileId}>파일</label>
        <input
          id={fileId}
          type="file"
          accept={ACCEPT}
          required
          className={styles.file}
          onChange={(e) => {
            const next = e.target.files?.[0];
            setFile(next);
            if (next && !name) setName(baseName(next.name));
            upload.reset();
          }}
        />
        {file && <span className={styles.muted}>{formatBytes(file.size)}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor={nameId}>이름</label>
        <input
          id={nameId}
          className={styles.input}
          value={name}
          maxLength={100}
          placeholder="파일 이름"
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <CsvOptionsFields
        value={options}
        onChange={(next) => {
          setOptions(next);
          upload.reset();
        }}
      />

      {upload.error && (
        <p role="alert" className={styles.error}>
          {upload.error.message}
        </p>
      )}

      <div className={dialogStyles.actions}>
        <button
          type="button"
          className={dialogStyles.secondary}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="submit"
          className={dialogStyles.primary}
          disabled={!file || !options.delimiter || upload.isPending}
        >
          {upload.isPending && <Spinner size="sm" tone="inherit" />}
          {upload.isPending ? "검사 중" : "업로드"}
        </button>
      </div>
    </form>
  );
}

type TypeChoice = ColumnType | "auto";

function EditBody({
  dataset,
  onDone,
  onCancel,
}: {
  dataset: DatasetStatus & { upload: NonNullable<DatasetStatus["upload"]> };
  onDone: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const nameId = useId();
  const saved = dataset.upload.options;
  const [name, setName] = useState(dataset.name);
  const [options, setOptions] = useState<CsvOptions>(saved);
  const [types, setTypes] = useState<Record<string, TypeChoice>>(
    saved.types ?? {},
  );
  const edit = useEditDataset();
  // 구분 기호나 헤더를 바꾸면 컬럼이 달라지므로, 타입 지정은 다시 적재한 뒤에 한다.
  const shapeChanged = !sameShape(options, saved);
  // 마지막으로 받아들인 검사 결과의 컬럼. 적재에 실패한 데이터셋도 컬럼을 안다.
  const columns = dataset.upload.inferred;
  const chosenTypes = Object.fromEntries(
    Object.entries(types).filter(
      (entry): entry is [string, ColumnType] =>
        entry[1] !== "auto" && columns.some((c) => c.name === entry[0]),
    ),
  );
  const optionsChanged =
    shapeChanged ||
    options.nullValue !== saved.nullValue ||
    JSON.stringify(chosenTypes) !== JSON.stringify(saved.types ?? {});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    edit.mutate(
      {
        id: dataset.id,
        name: name.trim() || dataset.name,
        options: optionsChanged
          ? { ...options, types: shapeChanged ? {} : chosenTypes }
          : undefined,
      },
      { onSuccess: onDone },
    );
  };

  return (
    <form className={styles.body} onSubmit={submit} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        수정
      </h2>
      <p className={styles.muted}>
        {dataset.upload.fileName} · {formatBytes(dataset.upload.size)}
        {dataset.upload.files.length > 1 &&
          ` · CSV ${dataset.upload.files.length}개`}
        . 전처리 옵션이나 타입을 바꾸면 원본 파일로 다시 검사해 적재합니다.
        거절되면 지금 데이터를 그대로 둡니다.
      </p>

      <div className={styles.field}>
        <label htmlFor={nameId}>이름</label>
        <input
          id={nameId}
          className={styles.input}
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <CsvOptionsFields
        value={options}
        onChange={(next) => {
          setOptions(next);
          edit.reset();
        }}
      />

      <div className={styles.types}>
        <table className={styles.table}>
          <caption>컬럼 타입</caption>
          <thead>
            <tr>
              <th>컬럼</th>
              <th>추론</th>
              <th>지정</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c) => (
              <tr key={c.name}>
                <td title={c.name}>{c.name}</td>
                <td className={styles.muted}>{COLUMN_TYPE_LABELS[c.type]}</td>
                <td>
                  <select
                    aria-label={`${c.name} 타입`}
                    className={styles.select}
                    value={types[c.name] ?? "auto"}
                    disabled={shapeChanged}
                    onChange={(e) => {
                      setTypes({
                        ...types,
                        [c.name]: e.target.value as TypeChoice,
                      });
                      edit.reset();
                    }}
                  >
                    <option value="auto">자동</option>
                    {(
                      Object.entries(COLUMN_TYPE_LABELS) as [
                        ColumnType,
                        string,
                      ][]
                    ).map(([type, label]) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shapeChanged && (
          <p className={styles.muted}>
            구분 기호나 헤더를 바꾸면 컬럼이 달라집니다. 저장해 다시 적재한 뒤
            타입을 지정하세요.
          </p>
        )}
      </div>

      {edit.error && (
        <p role="alert" className={styles.error}>
          {edit.error.message}
        </p>
      )}

      <div className={dialogStyles.actions}>
        <button
          type="button"
          className={dialogStyles.secondary}
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="submit"
          className={dialogStyles.primary}
          disabled={!options.delimiter || edit.isPending}
        >
          {edit.isPending && <Spinner size="sm" tone="inherit" />}
          {edit.isPending ? "검사 중" : optionsChanged ? "다시 적재" : "저장"}
        </button>
      </div>
    </form>
  );
}

/** 업로드 팝업. 받아들여지면 새 데이터셋 id로 끝나고, 취소하면 undefined다. */
export function openUploadDialog() {
  return overlay.openAsync<DatasetId | undefined>(
    ({ isOpen, close, unmount }) => (
      <Dialog
        isOpen={isOpen}
        onClose={() => close(undefined)}
        onExited={unmount}
        className={styles.dialog}
      >
        <UploadBody onDone={close} onCancel={() => close(undefined)} />
      </Dialog>
    ),
  );
}

/** 업로드한 데이터셋의 이름·전처리 옵션·컬럼 타입 수정 팝업 */
export function openEditDialog(
  dataset: DatasetStatus & { upload: NonNullable<DatasetStatus["upload"]> },
) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={styles.dialog}
    >
      <EditBody dataset={dataset} onDone={close} onCancel={close} />
    </Dialog>
  ));
}
