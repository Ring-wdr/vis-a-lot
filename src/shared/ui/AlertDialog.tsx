"use client";

import { t } from "@lingui/core/macro";
import { overlay } from "overlay-kit";
import type { ReactNode } from "react";
import { button } from "./button";
import { Dialog, dialogActions } from "./Dialog";
import "@/shared/config/messages";

// 팝업은 띄울 때의 언어로 문구를 정한다 (전역 i18n).
const okLabel = () => t({ message: "확인", context: "dialog button" });
const cancelLabel = () => t({ message: "취소", context: "dialog button" });

/**
 * 화면 어디서든 띄우는 알림 팝업. 팝업 상태는 overlay-kit이 들고 있어 본문 상태와 섞이지 않는다.
 */
export function showAlert(message: string) {
  const ok = okLabel();
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={close} onExited={unmount}>
      <p>{message}</p>
      <form method="dialog" className={dialogActions}>
        <button type="submit" className={button({ variant: "primary" })}>
          {ok}
        </button>
      </form>
    </Dialog>
  ));
}

/**
 * 확인·취소 팝업. 확인을 누르면 true, 취소·Esc면 false로 끝난다.
 * title을 주면 제목 줄을, children을 주면 문구 아래에 미리보기(썸네일 등)를 붙인다.
 * danger면 확인 버튼을 위험 동작 모양으로 그린다. 처음 포커스는 앞에 있는 취소 버튼이다.
 */
export function showConfirm(
  message: string,
  {
    confirmLabel = okLabel(),
    title,
    danger = false,
    children,
  }: {
    confirmLabel?: string;
    title?: string;
    danger?: boolean;
    children?: ReactNode;
  } = {},
) {
  const cancel = cancelLabel();
  return overlay.openAsync<boolean>(({ isOpen, close, unmount }) => (
    <Dialog isOpen={isOpen} onClose={() => close(false)} onExited={unmount}>
      {title && <h2 className="mb-2 text-base font-semibold">{title}</h2>}
      <p>{message}</p>
      {children}
      <div className={dialogActions}>
        <button type="button" className={button()} onClick={() => close(false)}>
          {cancel}
        </button>
        <button
          type="button"
          className={button({ variant: danger ? "danger" : "primary" })}
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
    confirmLabel = okLabel(),
    maxLength = 40,
  }: { defaultValue?: string; confirmLabel?: string; maxLength?: number } = {},
) {
  const cancel = cancelLabel();
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
            className="rounded-md border border-line bg-elevated px-2 py-1.5"
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
        <div className={dialogActions}>
          <button
            type="button"
            className={button()}
            onClick={() => close(null)}
          >
            {cancel}
          </button>
          <button type="submit" className={button({ variant: "primary" })}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Dialog>
  ));
}
