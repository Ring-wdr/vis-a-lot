"use client";

import { overlay } from "overlay-kit";
import { Dialog } from "./Dialog";
import styles from "./Dialog.module.css";

/**
 * 화면 어디서든 띄우는 알림 팝업. 팝업 상태는 overlay-kit이 들고 있어 본문 상태와 섞이지 않는다.
 */
export function showAlert(message: string) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={close} onExited={unmount}>
      <p>{message}</p>
      <form method="dialog" className={styles.actions}>
        <button type="submit" className={styles.primary}>
          확인
        </button>
      </form>
    </Dialog>
  ));
}

/** 확인·취소 팝업. 확인을 누르면 true, 취소·Esc면 false로 끝난다. */
export function showConfirm(
  message: string,
  { confirmLabel = "확인" }: { confirmLabel?: string } = {},
) {
  return overlay.openAsync<boolean>(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={() => close(false)} onExited={unmount}>
      <p>{message}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => close(false)}
        >
          취소
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => close(true)}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  ));
}
