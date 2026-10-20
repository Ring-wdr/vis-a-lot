"use client";

import { Palette, Split } from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import { WorkspaceScope } from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { Dialog } from "@/shared/ui/Dialog";
import dialogStyles from "@/shared/ui/Dialog.module.css";
import { ColorSettings } from "./ColorSettings";
import styles from "./SettingsDialog.module.css";
import { SplitSettings } from "./SplitSettings";

const MENUS = [
  { id: "color", label: "색상", Icon: Palette, Body: ColorSettings },
  { id: "split", label: "split by", Icon: Split, Body: SplitSettings },
] as const;
type MenuId = (typeof MENUS)[number]["id"];

function SettingsBody({ onClose }: { onClose: () => void }) {
  const [menu, setMenu] = useState<MenuId>("color");
  const titleId = useId();
  const { Body } = MENUS.find((m) => m.id === menu) ?? MENUS[0];

  return (
    <div className={styles.body}>
      <h2 id={titleId} className={styles.title}>
        전체 설정
      </h2>
      <div className={styles.layout}>
        <nav className={styles.menu} aria-label="설정 메뉴">
          {MENUS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-current={menu === id || undefined}
              onClick={() => setMenu(id)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.content}>
          <Body />
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
