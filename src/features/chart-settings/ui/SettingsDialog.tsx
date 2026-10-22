"use client";

import { List, MessageSquare, Palette, Split } from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import {
  OPTION_SECTIONS,
  type OptionSection,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import {
  useWorkspace,
  WorkspaceScope,
} from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import { SECTION_LABELS } from "../model/option-fields";
import { ColorSettings } from "./ColorSettings";
import { LegendSettings } from "./LegendSettings";
import { CommonOptionSettings, SECTION_ICONS } from "./OptionSettings";
import styles from "./SettingsDialog.module.css";
import { SplitSettings } from "./SplitSettings";
import { TooltipSettings } from "./TooltipSettings";

const MENUS = [
  { id: "color", label: "색상", Icon: Palette, Body: ColorSettings },
  { id: "legend", label: "legend", Icon: List, Body: LegendSettings },
  { id: "split", label: "split by", Icon: Split, Body: SplitSettings },
  { id: "tooltip", label: "툴팁", Icon: MessageSquare, Body: TooltipSettings },
] as const;
type MenuId = (typeof MENUS)[number]["id"] | OptionSection;

function SettingsBody({ onClose }: { onClose: () => void }) {
  const [menu, setMenu] = useState<MenuId>("color");
  const titleId = useId();
  const chartType = useWorkspace((s) => s.draft.chartType);
  // 차트 속성 구역은 고른 차트 종류가 쓰는 것만 보인다.
  const sections = OPTION_SECTIONS.filter((s) => supportsOption(chartType, s));
  const menus = [
    ...MENUS,
    ...sections.map((id) => ({
      id,
      label: SECTION_LABELS[id],
      Icon: SECTION_ICONS[id],
    })),
  ];
  const active = menus.some((m) => m.id === menu) ? menu : "color";
  const fixed = MENUS.find((m) => m.id === active);

  return (
    <div className={styles.body}>
      <h2 id={titleId} className={styles.title}>
        전체 설정
      </h2>
      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="설정 메뉴">
          {menus.map(({ id, label, Icon }, i) => (
            <button
              key={id}
              type="button"
              className={i === MENUS.length ? styles.menuDivider : undefined}
              aria-current={active === id || undefined}
              onClick={() => setMenu(id)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.content}>
          {fixed ? (
            <fixed.Body />
          ) : (
            <CommonOptionSettings
              key={active}
              section={active as OptionSection}
            />
          )}
        </div>
      </div>
      <div className={dialogStyles.actions}>
        <button type="button" className={styles.close} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

/**
 * 전체 설정 팝업. overlay는 본문 밖에서 그려지므로 연 탭의 작업 상태(store)를 넘겨받아
 * 그 범위 안에서 설정을 읽고 바꾼다.
 */
export function openSettingsDialog(store: WorkspaceStore) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={styles.dialog}
    >
      <WorkspaceScope store={store}>
        <SettingsBody onClose={close} />
      </WorkspaceScope>
    </Dialog>
  ));
}
