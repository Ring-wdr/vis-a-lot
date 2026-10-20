"use client";

import { useState } from "react";
import { useAlert } from "@/lib/alert-store";
import { api } from "@/lib/api";
import { restoreOf, shareUrl } from "@/lib/share";
import { useWorkspace } from "@/lib/workspace-store";
import styles from "./Workspace.module.css";

/** 현재 차트의 설정과 item 상태를 URL에 담아 복사한다. 공유용 서버는 필요 없다. */
export function ShareButton() {
  const current = useWorkspace((s) => s.current);
  const showAlert = useAlert((s) => s.show);
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
