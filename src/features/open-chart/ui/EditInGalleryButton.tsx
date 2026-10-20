"use client";

import { useMutation } from "@tanstack/react-query";
import { restoreOf } from "@/entities/chart/lib/share";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { workspaceStores } from "@/entities/workspace/model/workspace-store";
import { api } from "@/shared/api/api";
import { showAlert } from "@/shared/ui/AlertDialog";
import styles from "@/shared/ui/workspace.module.css";
import { useOpenChart } from "../model/open-chart";

/**
 * 다시 보던 차트를 gallery로 가져가 편집한다. gallery에서 바꾼 내용은 이 history 건에 이어서 기록된다.
 * gallery에서 그리던 차트는 이 차트로 바뀐다.
 */
export function EditInGalleryButton({ onOpened }: { onOpened: () => void }) {
  const historyId = useWorkspace((s) => s.current?.historyId);
  const open = useOpenChart(workspaceStores.gallery);
  const load = useMutation({
    mutationFn: (id: string) => api.historyDetail(id),
    onSuccess: (detail) =>
      open.mutate(
        {
          spec: detail.spec,
          restore: restoreOf(detail),
          historyId: detail.id,
        },
        { onSuccess: onOpened },
      ),
    onError: (err) => showAlert(err.message),
  });

  return (
    <button
      type="button"
      className={styles.drawButton}
      disabled={!historyId || load.isPending || open.isPending}
      onClick={() => historyId && load.mutate(historyId)}
    >
      gallery에서 편집
    </button>
  );
}
