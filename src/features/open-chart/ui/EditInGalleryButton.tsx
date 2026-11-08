"use client";

import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { restoreOf } from "@/entities/chart/lib/share";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import "../config/messages";
import { useOpenChart } from "../model/open-chart";

/**
 * 다시 보던 차트를 새 gallery 탭으로 가져가 편집한다.
 * gallery에서 바꾼 내용은 이 history 건에 이어서 기록된다.
 */
export function EditInGalleryButton() {
  const historyId = useWorkspace((s) => s.current?.historyId);
  const openGallery = useTabs((s) => s.openGallery);
  const notify = useWorkspace((s) => s.notify);
  const open = useOpenChart();
  const load = useMutation({
    mutationFn: (id: string) => api.historyDetail(id),
    onSuccess: (detail) => {
      const tab = openGallery(detail.spec);
      if (!tab) return;
      open.mutate({
        store: tab.store,
        spec: detail.spec,
        restore: restoreOf(detail),
        historyId: detail.id,
      });
    },
    onError: (err) => notify(err.message),
  });

  return (
    <button
      type="button"
      className={button({
        variant: "primary",
        size: "lg",
        class: "whitespace-nowrap",
      })}
      disabled={!historyId || load.isPending || open.isPending}
      aria-busy={load.isPending || open.isPending}
      onClick={() => historyId && load.mutate(historyId)}
    >
      {(load.isPending || open.isPending) && (
        <Spinner size="sm" tone="inherit" />
      )}
      <Trans>gallery에서 편집</Trans>
    </button>
  );
}
