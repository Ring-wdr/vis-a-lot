"use client";

// 데이터스토어 팝업: 등록된 데이터를 가상 스크롤 표로 보여주고, 고른 데이터로 gallery 탭을 연다.
// 업로드한 데이터가 위(최근 순), 샘플이 맨 아래다. 샘플은 등록을 눌러야 쓸 수 있다.

import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useRef, useState } from "react";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { TABS_LOCKED_HINT } from "@/entities/workspace/model/tabs-store";
import {
  useDatasets,
  useDeleteDataset,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetId, DatasetStatus } from "@/shared/api/types";
import { formatBytes } from "@/shared/lib/format";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import { EmptyState, Skeleton, Spinner } from "@/shared/ui/Loading";
import styles from "./DatastoreDialog.module.css";

/** 업로드·수정 팝업은 처음 열 때 불러온다. */
const loadUploadDialog = () => import("./UploadDialog");

const ROW_HEIGHT = 34;

/** 등록 시간: 2026-10-21 13:18:05 */
function registeredAt(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Row = { status: DatasetStatus; index: string };

/** 업로드는 오래된 것부터 1번, 화면에는 최근 순. 샘플은 맨 아래에 둔다. */
function rowsOf(datasets: DatasetStatus[], query: string): Row[] {
  const uploads = datasets.filter((d) => d.kind === "upload");
  const samples = datasets.filter((d) => d.kind === "sample");
  const rows: Row[] = [
    ...uploads.map((status, i) => ({
      status,
      index: String(uploads.length - i),
    })),
    ...samples.map((status) => ({ status, index: "샘플" })),
  ];
  const q = query.trim().toLowerCase();
  return q ? rows.filter((r) => r.status.name.toLowerCase().includes(q)) : rows;
}

function StatusCell({
  status,
  onGenerate,
  generating,
}: {
  status: DatasetStatus;
  onGenerate: () => void;
  generating: boolean;
}) {
  if (status.state === "missing") {
    return (
      <>
        <span className={styles.muted}>미등록</span>
        <button
          type="button"
          className={styles.inlineButton}
          disabled={generating}
          onClick={(e) => {
            e.stopPropagation();
            onGenerate();
          }}
        >
          등록
        </button>
      </>
    );
  }
  if (status.state === "failed") {
    return (
      <span className={styles.failed} title={status.error}>
        실패
      </span>
    );
  }
  if (status.state === "generating") {
    const ratio = status.done / Math.max(1, status.total);
    return (
      <span className={styles.progress}>
        <progress value={status.phase === "analyze" ? undefined : ratio} />
        {status.phase === "analyze" ? "통계" : `${Math.round(ratio * 100)}%`}
      </span>
    );
  }
  return <span>준비됨</span>;
}

/** 브라우저 저장소(IndexedDB 등) 사용량. 지원하지 않으면 null */
function useStorageEstimate(datasets: DatasetStatus[] | undefined) {
  // 데이터가 늘거나 줄면 다시 잰다.
  const key = datasets?.map((d) => `${d.id}:${d.state}`).join(",");
  return useQuery({
    queryKey: ["storage-estimate", key],
    queryFn: async () => (await navigator.storage?.estimate?.()) ?? null,
    enabled: datasets !== undefined,
    placeholderData: (prev) => prev,
  });
}

function DatastoreBody({
  initial,
  onClose,
}: {
  initial?: DatasetId;
  onClose: () => void;
}) {
  const titleId = useId();
  const searchId = useId();
  const openGallery = useTabs((s) => s.openGallery);
  const locked = useTabs((s) => s.locked);
  const datasets = useDatasets();
  const generate = useGenerateDataset();
  const remove = useDeleteDataset();
  const [picked, setPicked] = useState<DatasetId | undefined>(initial);
  const [query, setQuery] = useState("");
  const [opening, setOpening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const list = datasets.data?.datasets ?? [];
  const rows = rowsOf(list, query);
  const pickedStatus = list.find((d) => d.id === picked);
  const pickedReady = pickedStatus?.state === "ready";
  const editable =
    pickedStatus?.kind === "upload" && pickedStatus.state !== "generating";
  const storage = useStorageEstimate(datasets.data?.datasets);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const open = () => {
    if (!picked || !pickedReady || locked) return;
    // 고른 데이터로 새 gallery 탭(작업 공간)을 연다.
    openGallery({ dataset: picked });
    onClose();
  };

  const editPicked = async () => {
    if (!picked || !editable) return;
    setOpening(true);
    try {
      const { openUploadDialog } = await loadUploadDialog();
      const id = await openUploadDialog(picked);
      if (id) setPicked(id);
    } finally {
      setOpening(false);
    }
  };

  const deletePicked = async () => {
    if (!pickedStatus || !editable) return;
    const ok = await showConfirm(
      `'${pickedStatus.name}'을 삭제할까요? 이 데이터로 그린 탭은 다시 그릴 수 없게 됩니다.`,
      { confirmLabel: "삭제" },
    );
    if (!ok) return;
    remove.mutate(pickedStatus.id, {
      onSuccess: () => setPicked(undefined),
      onError: (err) => showAlert(err.message),
    });
  };

  const usage = storage.data;

  return (
    <div className={styles.body}>
      <h2 id={titleId} className={styles.title}>
        데이터 스토어
      </h2>

      <div className={styles.toolbar}>
        <label htmlFor={searchId} className={styles.search}>
          <Search size={14} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            placeholder="이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="수정"
            title={
              pickedStatus?.kind === "sample"
                ? "샘플은 수정할 수 없습니다"
                : "이름·전처리 옵션·컬럼 타입 수정"
            }
            disabled={!editable || opening}
            onClick={editPicked}
          >
            {opening ? <Spinner size="sm" /> : <Pencil size={15} />}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="삭제"
            title={
              pickedStatus?.kind === "sample"
                ? "샘플은 삭제할 수 없습니다"
                : "삭제"
            }
            disabled={!editable || remove.isPending}
            onClick={deletePicked}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="새로고침"
            title="새로고침"
            disabled={datasets.isFetching}
            onClick={() => datasets.refetch()}
          >
            <RefreshCw
              size={15}
              data-spinning={datasets.isFetching || undefined}
            />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className={styles.scroll}>
        <table className={styles.table} aria-labelledby={titleId}>
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>등록 시간</th>
              <th className={styles.number}>행 수</th>
              <th className={styles.number}>크기</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((v) => {
              const { status, index } = rows[v.index];
              const info = status.upload;
              return (
                <tr
                  key={status.id}
                  aria-selected={picked === status.id}
                  data-sample={status.kind === "sample" || undefined}
                  style={{ transform: `translateY(${v.start}px)` }}
                  onClick={() => setPicked(status.id)}
                  onDoubleClick={() => {
                    if (status.state !== "ready") return;
                    setPicked(status.id);
                    if (!locked) {
                      openGallery({ dataset: status.id });
                      onClose();
                    }
                  }}
                >
                  <td className={styles.muted}>{index}</td>
                  <td>
                    {/* 키보드로 고르는 자리. 행 클릭과 같은 일을 한다. */}
                    <button
                      type="button"
                      className={styles.nameButton}
                      aria-pressed={picked === status.id}
                      title={info?.fileName ?? status.name}
                      onClick={() => setPicked(status.id)}
                    >
                      {status.name}
                    </button>
                  </td>
                  <td>{info ? registeredAt(info.createdAt) : "–"}</td>
                  <td className={styles.number}>
                    {/* 샘플은 등록 전에도 만들 행 수를 안다. */}
                    {status.state === "ready" || status.kind === "sample"
                      ? status.total.toLocaleString()
                      : "–"}
                  </td>
                  <td
                    className={styles.number}
                    title={info ? `${info.size} B` : undefined}
                  >
                    {info ? formatBytes(info.size) : "–"}
                  </td>
                  <td>
                    <span className={styles.state}>
                      <StatusCell
                        status={status}
                        generating={generate.isPending}
                        onGenerate={() => {
                          generate.mutate(status.id);
                          setPicked(status.id);
                        }}
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {datasets.isPending ? (
          <div className={styles.skeletons}>
            <Skeleton width={90} />
            <Skeleton width={70} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Database size={20} />}
            title={query ? "찾는 데이터가 없습니다" : "데이터가 없습니다"}
          />
        ) : null}
      </div>

      {pickedStatus?.state === "failed" && pickedStatus.error && (
        <p role="alert" className={styles.error}>
          {pickedStatus.error}
        </p>
      )}
      {datasets.error && (
        <p role="alert" className={styles.error}>
          {datasets.error.message}
        </p>
      )}
      {generate.error && (
        <p role="alert" className={styles.error}>
          {generate.error.message}
        </p>
      )}

      <div className={styles.usage}>
        <span>
          내 저장소 사용량{" "}
          {usage?.usage !== undefined ? formatBytes(usage.usage) : "–"}
          {usage?.quota ? ` / ${formatBytes(usage.quota)}` : ""}
        </span>
        <progress
          value={usage?.usage ?? 0}
          max={usage?.quota || 1}
          aria-label="저장소 사용량"
        />
        <span className={styles.muted}>데이터 {rows.length}개</span>
      </div>

      <div className={dialogStyles.actions}>
        <button
          type="button"
          className={dialogStyles.secondary}
          onClick={onClose}
        >
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
          onClick={open}
        >
          gallery에서 열기
        </button>
      </div>
    </div>
  );
}

/** 데이터스토어 팝업. selected를 주면 그 데이터를 고른 채로 연다 (업로드 직후 등). */
export function openDatastoreDialog(selected?: DatasetId) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={styles.dialog}
    >
      <DatastoreBody initial={selected} onClose={close} />
    </Dialog>
  ));
}

/** 업로드 팝업을 열고, 적재가 끝나면 그 데이터를 고른 데이터스토어 팝업으로 바로 넘어간다. */
export async function openUploadThenDatastore() {
  const { openUploadDialog } = await loadUploadDialog();
  const id = await openUploadDialog();
  if (id) openDatastoreDialog(id);
}
