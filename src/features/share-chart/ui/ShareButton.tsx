"use client";

import { useState } from "react";
import { restoreOf, shareUrl } from "@/entities/chart/lib/share";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { showAlert } from "@/shared/ui/AlertDialog";
import styles from "@/shared/ui/workspace.module.css";

/** 현재 차트의 설정과 item 상태를 URL에 담아 복사한다. 공유용 서버는 필요 없다. */
export function ShareButton() {
  const current = useWorkspace((s) => s.current);
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={styles.secondaryButton}
      disabled={!current}
      onClick={async () => {
        if (!current) return;
        try {
          const detail = await api.historyDetail(current.historyId);
          await navigator.clipboard.writeText(
            shareUrl({ spec: detail.spec, restore: restoreOf(detail) }),
          );
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          showAlert(
            `링크를 복사하지 못했습니다: ${err instanceof Error ? err.message : err}`,
          );
        }
      }}
    >
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}
