"use client";

import { useEffect, useRef } from "react";
import { useAlert } from "@/lib/alert-store";
import styles from "./AlertDialog.module.css";

/** 네이티브 <dialog>로 띄우는 알림. 포커스 가두기와 Esc 닫기를 브라우저가 처리한다. */
export function AlertDialog() {
  const message = useAlert((s) => s.message);
  const close = useAlert((s) => s.close);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (message && !dialog.open) dialog.showModal();
    if (!message && dialog.open) dialog.close();
  }, [message]);

  return (
    <dialog ref={ref} className={styles.dialog} onClose={close}>
      <p>{message}</p>
      <form method="dialog">
        <button type="submit">확인</button>
      </form>
    </dialog>
  );
}
