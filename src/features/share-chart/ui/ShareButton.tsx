"use client";

import { useState } from "react";
import { restoreOf, shareUrl } from "@/entities/chart/lib/share";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import { showAlert } from "@/shared/ui/AlertDialog";
import { Spinner } from "@/shared/ui/Loading";
import styles from "@/shared/ui/workspace.module.css";

/** 현재 차트의 설정과 item 상태를 URL에 담아 복사한다. 공유용 서버는 필요 없다. */
export function ShareButton() {
  const current = useWorkspace((s) => s.current);
  const [copied, setCopied] = useState(false);
  // 공유 링크에 담을 item 상태를 서버에서 받는 동안
  const [copying, setCopying] = useState(false);

  return (
    <button
      type="button"
      className={styles.secondaryButton}
      disabled={!current || copying}
      aria-busy={copying}
      onClick={async () => {
        if (!current) return;
        setCopying(true);
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
        } finally {
          setCopying(false);
        }
      }}
    >
      {copying && <Spinner size="sm" />}
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}
