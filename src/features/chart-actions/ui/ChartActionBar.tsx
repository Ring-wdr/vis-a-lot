"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  ImageDown,
  type LucideIcon,
  SquareCheck,
  Table,
  TableProperties,
} from "lucide-react";
import { chartKindLabel, chartTitle } from "@/entities/chart/lib/title";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import {
  downloadAllChartsExcel,
  downloadChartPng,
  downloadItemData,
  drawnItemState,
} from "@/features/chart-actions/model/chart-download";
import { useColumns } from "@/shared/api/queries";
import { supports } from "@/shared/config/chart-kinds";
import { showAlert } from "@/shared/ui/AlertDialog";
import { toolButton } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import { openDataTable, openSampleTable } from "./DataTableDialog";

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
      className={toolButton()}
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

/** 이 차트 종류에서 못 쓰는 도구의 안내 */
const unsupported = (name: string, chartType: string) =>
  `${name} (${chartType}에서는 쓸 수 없음)`;

/**
 * 모드 바 옆의 차트 도구: legend 체크박스 표시, 고른 차트 다운로드, 모든 차트 엑셀로 다운로드,
 * 고른 차트의 데이터 다운로드(CSV)·데이터 테이블(모든 컬럼), 전체 데이터 테이블(최대 30,000행 샘플).
 * 데이터는 모두 draw 시점 필터를 따르고, 선택 필드 차트는 선택 영역이 있으면 그 안의 행만이다.
 * 모드처럼 하나만 고르는 게 아니라 누를 때마다 바로 동작하는 버튼들이다.
 * 체크박스 표시는 차트 종류가 지원할 때만 켠다(CHART_SUPPORT).
 */
export function ChartActionBar() {
  const current = useWorkspace((s) => s.current);
  const selectedItem = useWorkspace((s) => s.selectedItem);
  const checkboxes = useWorkspace((s) => s.showLegendCheckboxes);
  const toggleCheckboxes = useWorkspace((s) => s.toggleLegendCheckboxes);
  const notify = useWorkspace((s) => s.notify);
  const drawn = current !== undefined;
  const chartType = current?.spec.chartType;
  const typeLabel = current ? chartKindLabel(current.spec) : "";
  const checkboxOk = !chartType || supports(current?.spec, "checkbox");
  const columns = useColumns(current?.spec.dataset ?? "");

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
  const data = useMutation({
    mutationFn: (args: { chartId: string; jobId: string; key: string }) =>
      downloadItemData(args.chartId, args.jobId, args.key),
    onError: (err) => notify(err.message),
  });
  const table = useMutation({
    mutationFn: async (args: {
      chartId: string;
      jobId: string;
      key: string;
    }) => {
      const item = await drawnItemState(args.jobId, args.key);
      openDataTable(
        { chartId: args.chartId, itemKey: args.key, label: item.label },
        item.image.url,
      );
    },
    onError: (err) => notify(err.message),
  });
  /** 고른 item을 대상으로 하는 도구의 인자. 그린 차트나 고른 item이 없으면 undefined */
  const target =
    current && selectedItem
      ? { chartId: current.chartId, jobId: current.jobId, key: selectedItem }
      : undefined;
  /** 고른 item을 쓰는 도구의 라벨 */
  const itemLabel = (name: string) =>
    target ? name : `${name} (${PICK_ITEM})`;

  return (
    <div className="flex gap-1" role="toolbar" aria-label="차트 도구">
      <button
        type="button"
        className={toolButton()}
        title={
          checkboxOk ? "체크박스 표시" : unsupported("체크박스 표시", typeLabel)
        }
        aria-label="체크박스 표시"
        aria-pressed={checkboxes && checkboxOk}
        disabled={!drawn || !checkboxOk}
        onClick={toggleCheckboxes}
      >
        <SquareCheck size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <ActionButton
        label={selectedItem ? "차트 다운로드" : `차트 다운로드 (${PICK_ITEM})`}
        Icon={ImageDown}
        pending={chartPng.isPending}
        disabled={!target}
        onClick={() => target && chartPng.mutate(target)}
      />
      <ActionButton
        label="모든 차트 엑셀로 다운로드"
        Icon={FileSpreadsheet}
        pending={excel.isPending}
        disabled={!drawn}
        onClick={() => excel.mutate()}
      />
      <ActionButton
        label={itemLabel("데이터 다운로드")}
        Icon={Download}
        pending={data.isPending}
        disabled={!target}
        onClick={() => target && data.mutate(target)}
      />
      <ActionButton
        label={itemLabel("데이터 테이블")}
        Icon={Table}
        pending={table.isPending}
        disabled={!target}
        onClick={() => target && table.mutate(target)}
      />
      <ActionButton
        label="전체 데이터 테이블 (최대 30,000행 샘플)"
        Icon={TableProperties}
        disabled={!current}
        onClick={() =>
          current &&
          openSampleTable({
            chartId: current.chartId,
            jobId: current.jobId,
            title: chartTitle(current.spec, columns),
          })
        }
      />
    </div>
  );
}
