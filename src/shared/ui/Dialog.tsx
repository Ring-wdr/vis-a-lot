"use client";

import { type ReactNode, useEffect, useRef } from "react";
import styles from "./Dialog.module.css";

/**
 * overlay-kit이 주는 isOpen에 맞춰 여닫는 네이티브 <dialog>. 포커스 가두기와 Esc 닫기는 브라우저가 처리한다.
 * 닫히고 나면 onExited로 overlay를 unmount한다.
 */
export function Dialog({
  isOpen,
  onClose,
  onExited,
  className,
  labelledBy,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExited?: () => void;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // overlay-kit은 isOpen=false로 마운트한 뒤 다음 프레임에 연다. 한 번 열린 뒤에 닫혀야 unmount한다.
  const opened = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen) {
      opened.current = true;
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
    if (opened.current) onExited?.();
  }, [isOpen, onExited]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${className ?? ""}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
