"use client";

// 데이터스토어 팝업: 등록된 데이터를 가상 스크롤 표로 보여주고, 고른 데이터로 gallery 탭을 연다.
// 업로드한 데이터가 위(최근 순), 샘플이 맨 아래다. 샘플은 등록을 눌러야 쓸 수 있다.

import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Database, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useRef, useState } from "react";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { tabsLockedHint } from "@/entities/workspace/model/tabs-store";
import {
  useDatasets,
  useDeleteDataset,
  useGenerateDataset,
} from "@/shared/api/queries";
import type { DatasetId, DatasetStatus } from "@/shared/api/types";
import { formatBytes } from "@/shared/lib/format";
import { defineMessages, intlLocale, useT } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { EmptyState, Skeleton, Spinner } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    sample: "샘플",
    missing: "미등록",
    register: "등록",
    failed: "실패",
    analyzing: "통계",
    ready: "준비됨",
    confirmDelete: (name: string) =>
      `'${name}'을 삭제할까요? 이 데이터로 그린 탭은 다시 그릴 수 없게 됩니다.`,
    delete: "삭제",
    title: "데이터 스토어",
    search: "이름 검색",
    edit: "수정",
    sampleNoEdit: "샘플은 수정할 수 없습니다",
    editHint: "이름·전처리 옵션·컬럼 타입 수정",
    sampleNoDelete: "샘플은 삭제할 수 없습니다",
    refresh: "새로고침",
    number: "번호",
    name: "이름",
    registeredAt: "등록 시간",
    rows: "행 수",
    size: "크기",
    status: "상태",
    noMatch: "찾는 데이터가 없습니다",
    noData: "데이터가 없습니다",
    storageUsage: "내 저장소 사용량",
    storageUsageLabel: "저장소 사용량",
    count: (n: number) => `데이터 ${n}개`,
    close: "닫기",
    pickReady: "준비된 데이터를 선택하세요",
    openInGallery: "gallery에서 열기",
  },
  en: {
    sample: "Sample",
    missing: "Not added",
    register: "Add",
    failed: "Failed",
    analyzing: "Stats",
    ready: "Ready",
    confirmDelete: (name: string) =>
      `Delete '${name}'? Tabs drawn from this data can no longer be redrawn.`,
    delete: "Delete",
    title: "Data store",
    search: "Search by name",
    edit: "Edit",
    sampleNoEdit: "Samples can't be edited",
    editHint: "Edit name, preprocessing options, column types",
    sampleNoDelete: "Samples can't be deleted",
    refresh: "Refresh",
    number: "No.",
    name: "Name",
    registeredAt: "Added",
    rows: "Rows",
    size: "Size",
    status: "Status",
    noMatch: "No matching data",
    noData: "No data",
    storageUsage: "My storage",
    storageUsageLabel: "Storage usage",
    count: (n: number) => `${n} ${n === 1 ? "dataset" : "datasets"}`,
    close: "Close",
    pickReady: "Select ready data",
    openInGallery: "Open in gallery",
  },
});

/** 업로드·수정 팝업은 처음 열 때 불러온다. */
const loadUploadDialog = () => import("./UploadDialog");

// 행 높이(h-8.5)와 같아야 한다.
const ROW_HEIGHT = 34;

const error = "m-0 whitespace-pre-wrap text-ui text-danger";

const iconButton =
  "inline-flex size-7.5 cursor-pointer items-center justify-center rounded-md border border-line bg-elevated text-fg-secondary disabled:cursor-not-allowed disabled:opacity-40";

// 가상 스크롤 표: 행을 tbody 안에 겹쳐 놓고 translateY로 옮긴다. 머리와 행이 같은 칸 폭을 쓴다.
const row =
  "grid h-8.5 grid-cols-[3.5rem_minmax(10rem,1fr)_10rem_6rem_5.25rem_8.75rem] items-center border-line border-b";
const cell = "min-w-0 truncate px-2.5 text-left";
const head = cn(cell, "font-semibold text-fg-secondary");
const number = "text-right tabular-nums";

/** 등록 시간: 2026-10-21 13:18:05 */
function registeredAt(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

type Row = { status: DatasetStatus; index: string };

/** 업로드는 오래된 것부터 1번, 화면에는 최근 순. 샘플은 맨 아래에 둔다. */
function rowsOf(
  datasets: DatasetStatus[],
  query: string,
  sampleLabel: string,
): Row[] {
  const uploads = datasets.filter((d) => d.kind === "upload");
  const samples = datasets.filter((d) => d.kind === "sample");
  const rows: Row[] = [
    ...uploads.map((status, i) => ({
      status,
      index: String(uploads.length - i),
    })),
    ...samples.map((status) => ({ status, index: sampleLabel })),
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
  const text = useT(messages);
  if (status.state === "missing") {
    return (
      <>
        <span className="text-fg-muted">{text.missing}</span>
        <button
          type="button"
          className="cursor-pointer rounded-md bg-accent px-2.5 py-0.5 text-xs text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={generating}
          onClick={(e) => {
            e.stopPropagation();
            onGenerate();
          }}
        >
          {text.register}
        </button>
      </>
    );
  }
  if (status.state === "failed") {
    return (
      <span className="text-danger" title={status.error}>
        {text.failed}
      </span>
    );
  }
  if (status.state === "generating") {
    const ratio = status.done / Math.max(1, status.total);
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-secondary">
        <progress
          className="w-16"
          value={status.phase === "analyze" ? undefined : ratio}
        />
        {status.phase === "analyze"
          ? text.analyzing
          : `${Math.round(ratio * 100)}%`}
      </span>
    );
  }
  return <span>{text.ready}</span>;
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
  const text = useT(messages);
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
  const rows = rowsOf(list, query, text.sample);
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
    const ok = await showConfirm(text.confirmDelete(pickedStatus.name), {
      confirmLabel: text.delete,
    });
    if (!ok) return;
    remove.mutate(pickedStatus.id, {
      onSuccess: () => setPicked(undefined),
      onError: (err) => showAlert(err.message),
    });
  };

  const usage = storage.data;

  return (
    <div className="flex flex-col gap-2.5">
      <h2 id={titleId} className="text-base font-bold">
        {text.title}
      </h2>

      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={searchId}
          className="flex w-[min(17.5rem,100%)] items-center gap-1.5 rounded-md border border-line bg-elevated px-2 py-1 text-fg-muted"
        >
          <Search size={14} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            className="min-w-0 flex-1 bg-transparent text-ui text-fg outline-none"
            placeholder={text.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex gap-1">
          <button
            type="button"
            className={iconButton}
            aria-label={text.edit}
            title={
              pickedStatus?.kind === "sample"
                ? text.sampleNoEdit
                : text.editHint
            }
            disabled={!editable || opening}
            onClick={editPicked}
          >
            {opening ? <Spinner size="sm" /> : <Pencil size={15} />}
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={text.delete}
            title={
              pickedStatus?.kind === "sample"
                ? text.sampleNoDelete
                : text.delete
            }
            disabled={!editable || remove.isPending}
            onClick={deletePicked}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={text.refresh}
            title={text.refresh}
            disabled={datasets.isFetching}
            onClick={() => datasets.refetch()}
          >
            <RefreshCw
              size={15}
              data-spinning={datasets.isFetching || undefined}
              className="data-spinning:animate-spin data-spinning:[animation-duration:0.8s]"
            />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-[min(22.5rem,42dvh)] overflow-auto rounded-md border border-line"
      >
        <table
          className="grid w-full min-w-160 border-collapse text-ui"
          aria-labelledby={titleId}
        >
          <thead className="z-sticky sticky top-0 grid bg-panel">
            <tr className={row}>
              <th className={head}>{text.number}</th>
              <th className={head}>{text.name}</th>
              <th className={head}>{text.registeredAt}</th>
              <th className={cn(head, number)}>{text.rows}</th>
              <th className={cn(head, number)}>{text.size}</th>
              <th className={head}>{text.status}</th>
            </tr>
          </thead>
          <tbody
            className="relative grid"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const { status, index } = rows[v.index];
              const info = status.upload;
              return (
                <tr
                  key={status.id}
                  className={cn(
                    row,
                    "absolute top-0 left-0 w-full cursor-default not-aria-selected:hover:bg-surface aria-selected:bg-accent-soft",
                  )}
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
                  <td
                    className={cn(cell, "text-fg-muted in-data-sample:text-xs")}
                  >
                    {index}
                  </td>
                  <td className={cell}>
                    {/* 키보드로 고르는 자리. 행 클릭과 같은 일을 한다. */}
                    <button
                      type="button"
                      className="max-w-full cursor-pointer truncate text-left text-ui"
                      aria-pressed={picked === status.id}
                      title={info?.fileName ?? status.name}
                      onClick={() => setPicked(status.id)}
                    >
                      {status.name}
                    </button>
                  </td>
                  <td className={cell}>
                    {info ? registeredAt(info.createdAt) : "–"}
                  </td>
                  <td className={cn(cell, number)}>
                    {/* 샘플은 등록 전에도 만들 행 수를 안다. */}
                    {status.state === "ready" || status.kind === "sample"
                      ? status.total.toLocaleString(intlLocale())
                      : "–"}
                  </td>
                  <td
                    className={cn(cell, number)}
                    title={info ? `${info.size} B` : undefined}
                  >
                    {info ? formatBytes(info.size) : "–"}
                  </td>
                  <td className={cell}>
                    <span className="flex items-center gap-2">
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
          <div className="flex flex-col gap-2 p-2.5">
            <Skeleton width={90} />
            <Skeleton width={70} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<Database size={20} />}
            title={query ? text.noMatch : text.noData}
          />
        ) : null}
      </div>

      {pickedStatus?.state === "failed" && pickedStatus.error && (
        <p role="alert" className={error}>
          {pickedStatus.error}
        </p>
      )}
      {datasets.error && (
        <p role="alert" className={error}>
          {datasets.error.message}
        </p>
      )}
      {generate.error && (
        <p role="alert" className={error}>
          {generate.error.message}
        </p>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 text-xs text-fg-secondary">
        <span>
          {text.storageUsage}{" "}
          {usage?.usage !== undefined ? formatBytes(usage.usage) : "–"}
          {usage?.quota ? ` / ${formatBytes(usage.quota)}` : ""}
        </span>
        <progress
          className="w-full"
          value={usage?.usage ?? 0}
          max={usage?.quota || 1}
          aria-label={text.storageUsageLabel}
        />
        <span className="text-fg-muted">{text.count(rows.length)}</span>
      </div>

      <div className={dialogActions}>
        <button type="button" className={button()} onClick={onClose}>
          {text.close}
        </button>
        <button
          type="button"
          className={button({ variant: "primary" })}
          disabled={!pickedReady || locked}
          title={
            locked ? tabsLockedHint() : pickedReady ? undefined : text.pickReady
          }
          onClick={open}
        >
          {text.openInGallery}
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
      className="w-[min(55rem,calc(100vw-2rem))] max-w-none"
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
