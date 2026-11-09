"use client";

import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { intlLocale } from "@vis-a-lot/shared/lib/i18n";
import { itemSizeFor } from "@/entities/chart/lib/grid-layout";
import { useDatasetLabels } from "@/entities/dataset/lib/labels";
import {
  useWorkspace,
  useWorkspaceMutationKey,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import {
  useCancelJob,
  useDatasetSchema,
  useDatasetState,
  useSchemaState,
} from "@/shared/api/queries";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import "../config/messages";
import { useDrawState } from "../model/draw-state";

/**
 * draw → pending(비활성) → 서버에서 작업 상태를 받으면 cancel → job이 끝나면 다시 draw.
 */
export function DrawButton() {
  const { t } = useLingui();
  const labels = useDatasetLabels();
  // 화면에 쓰는 값(데이터셋, x·y를 골랐는지)만 구독한다. 그릴 설정 전체와 grid 영역 크기는 누를 때 getState로 읽는다.
  // draft 전체를 구독하면 필터·grid·공통 속성을 바꿀 때마다 다시 그린다.
  const store = useWorkspaceStore();
  const datasetId = useWorkspace((s) => s.draft.dataset);
  const axesChosen = useWorkspace((s) => s.draft.x !== "" && s.draft.y !== "");
  const hasGridArea = useWorkspace((s) => s.gridArea !== undefined);
  const jobId = useWorkspace((s) => s.current?.jobId);
  const setCurrent = useWorkspace((s) => s.setCurrent);
  const notify = useWorkspace((s) => s.notify);
  const cancel = useCancelJob();
  // 렌더 중에 읽어 둔다. 누를 때만 읽으면 react-query가 쓰는 필드를 몰라 목록을 다시 받을 때마다 다시 그린다.
  const datasetState = useDatasetState(datasetId).data;

  // 컬럼은 데이터셋 스키마에서 고르므로, 스키마를 받고 x·y가 정해져야 그릴 수 있다.
  const schema = useDatasetSchema(datasetId);
  const ready = schema.data !== undefined && axesChosen;
  const deleted = useSchemaState(datasetId) === "deleted";

  const draw = useMutation({
    mutationKey: useWorkspaceMutationKey("draw"),
    mutationFn: async () => {
      // 누른 때의 설정으로 그린다. 그린 차트(current)의 spec도 이 값이다.
      const { gridArea, draft } = store.getState();
      if (!gridArea) throw new Error(t`grid 영역 크기를 아직 모릅니다.`);
      // 데이터가 준비돼 있으면 split 조합 개수를 미리 확인한다. 아직 없으면 job이 확인한다.
      if (draft.splitBy.length > 0 && datasetState === "ready") {
        // 최대 개수는 서버가 정해 응답에 담아 준다.
        const { count, limit } = await api.splitCount(
          draft.dataset,
          draft.splitBy,
          draft.filters,
        );
        if (count > limit) {
          const countText = count.toLocaleString(intlLocale());
          const limitText = limit.toLocaleString(intlLocale());
          notify(
            t({
              message: `split 조합이 ${countText}개입니다. 최대 ${limitText}개까지 그릴 수 있습니다.`,
              comment: "countText, limitText: 자릿수 구분을 넣은 숫자",
            }),
          );
          return undefined;
        }
      }
      const res = await api.createChart({
        spec: draft,
        itemSize: itemSizeFor(gridArea, draft.grid),
      });
      return { ...res, spec: draft };
    },
    onSuccess: (chart) => chart && setCurrent(chart),
  });

  // 탭을 오가 다시 마운트돼도 이 탭의 draw가 진행 중이면 다시 누를 수 없게 한다.
  const state = useDrawState();

  return (
    <>
      {state === "cancel" ? (
        <button
          type="button"
          className={button({ variant: "danger", size: "lg" })}
          disabled={cancel.isPending}
          onClick={() => jobId && cancel.mutate(jobId)}
        >
          cancel
        </button>
      ) : (
        <button
          type="button"
          className={button({ variant: "primary", size: "lg" })}
          disabled={state === "pending" || !hasGridArea || !ready || deleted}
          title={
            deleted
              ? labels.deletedDataset
              : ready
                ? undefined
                : t`데이터를 등록하고 x, y를 고르면 그릴 수 있습니다`
          }
          aria-busy={state === "pending"}
          onClick={() => draw.mutate()}
        >
          {state === "pending" ? (
            <>
              <Spinner size="sm" tone="inherit" />
              pending
            </>
          ) : (
            "draw"
          )}
        </button>
      )}
      {(draw.error ?? cancel.error) && (
        <p role="alert" className="text-xs text-danger">
          {(draw.error ?? cancel.error)?.message}
        </p>
      )}
    </>
  );
}
