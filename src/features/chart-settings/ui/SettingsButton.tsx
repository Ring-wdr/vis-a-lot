"use client";

import { Trans } from "@lingui/react/macro";
import { Settings2 } from "lucide-react";
import {
  useWorkspace,
  useWorkspaceStore,
} from "@/entities/workspace/model/workspace-scope";
import { button } from "@/shared/ui/button";
import "../config/messages";
import { openSettingsDialog } from "./SettingsDialog";

/** 왼쪽 패널 하단: 색상, split 구분 기호처럼 자주 바꾸지 않는 설정을 팝업으로 모은다. */
export function SettingsButton() {
  const store = useWorkspaceStore();
  const color = useWorkspace((s) => s.draft.common.color);
  return (
    <button
      type="button"
      className={button({ size: "sm" })}
      onClick={() => openSettingsDialog(store)}
    >
      <Settings2 size={14} aria-hidden="true" />
      <Trans>전체 설정</Trans>
      <span
        className="mr-1.5 inline-block size-3 rounded-full align-[-1px]"
        style={{ background: color }}
        aria-hidden="true"
      />
    </button>
  );
}
