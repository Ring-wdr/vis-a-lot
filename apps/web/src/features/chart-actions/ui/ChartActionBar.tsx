"use client";

import { t as tGlobal } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { intlLocale } from "@vis-a-lot/shared/lib/i18n";
import {
  AlignVerticalSpaceAround,
  Download,
  FileSpreadsheet,
  ImageDown,
  type LucideIcon,
  SquareCheck,
  Table,
  TableProperties,
} from "lucide-react";
import { chartKindLabel, chartTitle } from "@/entities/chart/lib/title";
import { controlLimitSupport } from "@/entities/chart/model/chart-options";
import {
  useWorkspace,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
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
import "../config/messages";
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

/**
 * 모드 바 옆의 차트 도구: legend 체크박스 표시, 관리선 설정, 고른 차트 다운로드, 모든 차트 엑셀로 다운로드,
 * 고른 차트의 데이터 다운로드(CSV)·데이터 테이블(모든 컬럼), 전체 데이터 테이블(최대 30,000행 샘플).
 * 데이터는 모두 draw 시점 필터를 따르고, 선택 필드 차트는 선택 영역이 있으면 그 안의 행만이다.
 * 모드처럼 하나만 고르는 게 아니라 누를 때마다 바로 동작하는 버튼들이다.
 * 체크박스 표시는 차트 종류가 지원할 때만 켠다(CHART_SUPPORT). 관리선은 그린 차트와 다음 draw의 차트가
 * 모두 관리선을 쓸 때만 켠다 (전체 설정 팝업은 다음 draw의 공통 속성을 고친다).
 */
export function ChartActionBar({
  onOpenControlLimit,
}: {
  /** 전체 설정 팝업을 관리선 구역으로 연다. 설정 팝업은 다른 feature라 조합하는 쪽이 넘긴다. */
  onOpenControlLimit: (store: WorkspaceStore) => void;
}) {
  const { t } = useLingui();
  const store = useWorkspaceStore();
  const current = useWorkspace((s) => s.current);
  const selectedItem = useWorkspace((s) => s.selectedItem);
  const checkboxes = useWorkspace((s) => s.showLegendCheckboxes);
  const toggleCheckboxes = useWorkspace((s) => s.toggleLegendCheckboxes);
  const notify = useWorkspace((s) => s.notify);
  const drawn = current !== undefined;
  const chartType = current?.spec.chartType;
  const chartKind = current ? chartKindLabel(current.spec) : "";
  const checkboxOk = !chartType || supports(current?.spec, "checkbox");
  const draftType = useWorkspace((s) => s.draft.chartType);
  const draftSub = useWorkspace((s) => s.draft.subType);
  const draftSpec = { chartType: draftType, subType: draftSub };
  // 관리선을 못 쓰는 차트 이름 (그린 차트 먼저). 둘 다 쓰면 undefined
  const limitBlockedKind = !current
    ? undefined
    : !controlLimitSupport(current.spec)
      ? chartKind
      : !controlLimitSupport(draftSpec)
        ? chartKindLabel(draftSpec)
        : undefined;
  const columns = useColumns(current?.spec.dataset ?? "");

  const chartPng = useMutation({
    mutationFn: ({
      chartId,
      jobId,
      key,
    }: {
      chartId: string;
      jobId: string;
      key: string;
    }) => downloadChartPng(chartId, jobId, key),
    onError: (err) => notify(err.message),
  });
  const excel = useMutation({
    mutationFn: () => {
      if (!current) throw new Error(tGlobal`그린 차트가 없습니다.`);
      // 검색 중이면 맞는 item만 담는다. 그리지 않는 값이라 누를 때 읽는다.
      return downloadAllChartsExcel(
        current.chartId,
        current.jobId,
        current.spec,
        store.getState().search,
      );
    },
    onSuccess: ({ written, total }) => {
      if (written < total) {
        const totalText = total.toLocaleString(intlLocale());
        const writtenText = written.toLocaleString(intlLocale());
        showAlert(
          tGlobal({
            message: `차트가 ${totalText}개라 앞에서부터 ${writtenText}개만 넣었습니다.`,
            comment: "totalText, writtenText: 자릿수 구분을 넣은 숫자",
          }),
        );
      }
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
  const needsItem = (name: string) =>
    t({
      message: `${name} (차트를 눌러 고른 뒤 쓸 수 있습니다)`,
      comment: "name: 도구 이름",
    });
  const itemLabel = (name: string) => (target ? name : needsItem(name));
  const checkboxesText = t`체크박스 표시`;
  const controlLimitText = t({ message: "관리선", context: "chart tool" });
  const downloadChart = t`차트 다운로드`;
  /** 이 차트 종류에서 못 쓰는 도구의 안내 */
  const unsupported = (name: string, chartKind: string) =>
    t({
      message: `${name} (${chartKind}에서는 쓸 수 없음)`,
      comment: "name: 도구 이름, chartKind: 차트 종류 이름",
    });

  return (
    <div className="flex gap-1" role="toolbar" aria-label={t`차트 도구`}>
      <button
        type="button"
        className={toolButton()}
        title={
          checkboxOk ? checkboxesText : unsupported(checkboxesText, chartKind)
        }
        aria-label={checkboxesText}
        aria-pressed={checkboxes && checkboxOk}
        disabled={!drawn || !checkboxOk}
        onClick={toggleCheckboxes}
      >
        <SquareCheck size={16} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={toolButton()}
        title={
          limitBlockedKind
            ? unsupported(controlLimitText, limitBlockedKind)
            : controlLimitText
        }
        aria-label={controlLimitText}
        disabled={!drawn || limitBlockedKind !== undefined}
        onClick={() => onOpenControlLimit(store)}
      >
        <AlignVerticalSpaceAround
          size={16}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      <ActionButton
        label={selectedItem ? downloadChart : needsItem(downloadChart)}
        Icon={ImageDown}
        pending={chartPng.isPending}
        disabled={!target}
        onClick={() => target && chartPng.mutate(target)}
      />
      <ActionButton
        label={t`모든 차트 엑셀로 다운로드`}
        Icon={FileSpreadsheet}
        pending={excel.isPending}
        disabled={!drawn}
        onClick={() => excel.mutate()}
      />
      <ActionButton
        label={itemLabel(t`데이터 다운로드`)}
        Icon={Download}
        pending={data.isPending}
        disabled={!target}
        onClick={() => target && data.mutate(target)}
      />
      <ActionButton
        label={itemLabel(t`데이터 테이블`)}
        Icon={Table}
        pending={table.isPending}
        disabled={!target}
        onClick={() => target && table.mutate(target)}
      />
      <ActionButton
        label={t`전체 데이터 테이블 (최대 30,000행 샘플)`}
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
