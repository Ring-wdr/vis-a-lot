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
