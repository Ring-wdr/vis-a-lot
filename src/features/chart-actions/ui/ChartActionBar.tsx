"use client";

import { useMutation } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  ImageDown,
  type LucideIcon,
  SquareCheck,
} from "lucide-react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  downloadAllChartsExcel,
  downloadChartPng,
} from "@/features/chart-actions/model/chart-download";
import { showAlert } from "@/shared/ui/AlertDialog";
import { Spinner } from "@/shared/ui/Loading";
import styles from "@/shared/ui/workspace.module.css";

/** 누르면 바로 동작하는 도구 버튼. 진행 중이면 아이콘 대신 spinner를 보인다. */
function ActionButton({
  label,
  Icon,
  pending = false,
  disabled,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  pending?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={onClick}
    >
      {pending ? (
        <Spinner size="sm" />
      ) : (
        <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
      )}
    </button>
  );
}

const PICK_ITEM = "차트를 눌러 고른 뒤 쓸 수 있습니다";

/**
 * 모드 바 옆의 차트 도구: legend 체크박스 표시, 고른 차트 다운로드, 모든 차트 엑셀로 다운로드.
 * 모드처럼 하나만 고르는 게 아니라 누를 때마다 바로 동작하는 버튼들이다.
 */
export function ChartActionBar() {
  const current = useWorkspace((s) => s.current);
  const selectedItem = useWorkspace((s) => s.selectedItem);
  const checkboxes = useWorkspace((s) => s.showLegendCheckboxes);
  const toggleCheckboxes = useWorkspace((s) => s.toggleLegendCheckboxes);
  const notify = useWorkspace((s) => s.notify);
  const drawn = current !== undefined;

  const chartPng = useMutation({
    mutationFn: ({ jobId, key }: { jobId: string; key: string }) =>
      downloadChartPng(jobId, key),
    onError: (err) => notify(err.message),
  });
  const excel = useMutation({
    mutationFn: () => {
      if (!current) throw new Error("그린 차트가 없습니다.");
      return downloadAllChartsExcel(current.jobId, current.spec);
    },
    onSuccess: ({ written, total }) => {
      if (written < total)
        showAlert(
          `차트가 ${total.toLocaleString()}개라 앞에서부터 ${written.toLocaleString()}개만 넣었습니다.`,
        );
    },
    onError: (err) => notify(err.message),
  });

  return (
    <div className={styles.modeBar} role="toolbar" aria-label="차트 도구">
      <button
        type="button"
        title="체크박스 표시"
        aria-label="체크박스 표시"
        aria-pressed={checkboxes}
        disabled={!drawn}
        onClick={toggleCheckboxes}
      >
        <SquareCheck size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <ActionButton
        label={selectedItem ? "차트 다운로드" : `차트 다운로드 (${PICK_ITEM})`}
        Icon={ImageDown}
        pending={chartPng.isPending}
        disabled={!drawn || !selectedItem}
        onClick={() =>
          current &&
          selectedItem &&
          chartPng.mutate({ jobId: current.jobId, key: selectedItem })
        }
      />
      <ActionButton
        label="모든 차트 엑셀로 다운로드"
        Icon={FileSpreadsheet}
        pending={excel.isPending}
        disabled={!drawn}
        onClick={() => excel.mutate()}
      />
    </div>
  );
}
