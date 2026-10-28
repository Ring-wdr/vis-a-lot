"use client";

import { Settings2 } from "lucide-react";
import {
  useWorkspace,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { button } from "@/shared/ui/button";
import { openSettingsDialog } from "./SettingsDialog";

const messages = defineMessages({
  ko: { label: "전체 설정" },
  en: { label: "Settings" },
});

/** 왼쪽 패널 하단: 색상, split 구분 기호처럼 자주 바꾸지 않는 설정을 팝업으로 모은다. */
export function SettingsButton() {
  const text = useT(messages);
  const store = useWorkspaceStore();
  const color = useWorkspace((s) => s.draft.common.color);
  return (
    <button
      type="button"
      className={button({ size: "sm" })}
      onClick={() => openSettingsDialog(store)}
    >
      <Settings2 size={14} aria-hidden="true" />
      {text.label}
      <span
        className="mr-1.5 inline-block size-3 rounded-full align-[-1px]"
        style={{ background: color }}
        aria-hidden="true"
      />
    </button>
  );
}
