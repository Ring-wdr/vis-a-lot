"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./Dialog.module.css";

/**
 * 열린 modal <dialog>는 top layer에 올라가고 나머지 문서를 inert로 만든다. body에 portal한 팝업(select 목록 등)은
 * z-index와 상관없이 dialog 아래에 깔리고 클릭도 막히므로, dialog 안의 팝업은 이 요소 안으로 portal한다.
 */
const DialogContainerContext = createContext<HTMLElement | null>(null);

/** 감싸고 있는 dialog 요소. dialog 밖이면 null(= body로 portal) */
export function useDialogContainer() {
  return useContext(DialogContainerContext);
}

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
  // 팝업 portal 대상. ref는 바뀌어도 다시 그리지 않으므로 state로도 들고 있는다.
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);
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
      ref={(el) => {
        ref.current = el;
        setContainer(el);
      }}
      className={`${styles.dialog} ${className ?? ""}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
    >
      <DialogContainerContext value={container}>
        {children}
      </DialogContainerContext>
    </dialog>
  );
}
