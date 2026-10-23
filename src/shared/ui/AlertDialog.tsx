"use client";

import { overlay } from "overlay-kit";
import { button } from "./button";
import { Dialog, dialogActions } from "./Dialog";

/**
 * 화면 어디서든 띄우는 알림 팝업. 팝업 상태는 overlay-kit이 들고 있어 본문 상태와 섞이지 않는다.
 */
export function showAlert(message: string) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={close} onExited={unmount}>
      <p>{message}</p>
      <form method="dialog" className={dialogActions}>
        <button type="submit" className={button({ variant: "primary" })}>
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
      <div className={dialogActions}>
        <button type="button" className={button()} onClick={() => close(false)}>
          취소
        </button>
        <button
          type="button"
          className={button({ variant: "primary" })}
          onClick={() => close(true)}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  ));
}

/** 이름 하나를 받는 팝업. 확인하면 다듬은 글자, 취소·Esc·빈 값이면 null로 끝난다. */
export function showPrompt(
  message: string,
  {
    defaultValue = "",
    confirmLabel = "확인",
    maxLength = 40,
  }: { defaultValue?: string; confirmLabel?: string; maxLength?: number } = {},
) {
  return overlay.openAsync<string | null>(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={() => close(null)} onExited={unmount}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get("value"));
          close(value.trim() || null);
        }}
      >
        <label className="flex flex-col gap-2">
          <span>{message}</span>
          <input
            name="value"
            defaultValue={defaultValue}
            maxLength={maxLength}
            required
            autoFocus
            className="rounded-md border border-line bg-elevated px-2 py-1.5 leading-[inherit]"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <div className={dialogActions}>
          <button
            type="button"
            className={button()}
            onClick={() => close(null)}
          >
            취소
          </button>
          <button type="submit" className={button({ variant: "primary" })}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  ));
}
