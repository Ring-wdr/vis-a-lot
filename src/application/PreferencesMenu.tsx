"use client";

import { Popover } from "@base-ui/react/popover";
import { useLingui } from "@lingui/react/macro";
import { Settings2 } from "lucide-react";
import { LocaleSelect } from "@/features/switch-locale/ui/LocaleSelect";
import { ThemeSelect } from "@/features/switch-theme/ui/ThemeSelect";
import { navButton } from "@/shared/ui/nav";
import { preferencesPopover } from "@/shared/ui/preferences-popover";
import "./messages";

const p = preferencesPopover();

/** 로그인 사용자 메뉴가 없는 상단 바(피드, 도움말)의 화면 설정: 테마와 언어. 트리거는 아이콘만 둔다. */
export function PreferencesMenu() {
  const { t } = useLingui();
  const label = t`화면 설정`;
  return (
    <Popover.Root>
      <Popover.Trigger
        className={navButton({
          class: "px-2 data-popup-open:border-line data-popup-open:bg-elevated",
        })}
        aria-label={label}
        title={label}
      >
        <Settings2 size={14} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className={p.positioner()}
          align="end"
          sideOffset={4}
        >
          <Popover.Popup className={p.popup()}>
            <ThemeSelect />
            <LocaleSelect />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
