"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { OptionsItem } from "@/entities/workspace/model/workspace-store";
import styles from "@/shared/ui/workspace.module.css";

/** item 설정 팝업의 "차트 속성" 버튼. 오른쪽 차트 속성 패널을 이 item 범위로 연다. */
export function ItemOptionsButton({
  item,
  disabled,
}: {
  item: OptionsItem;
  disabled: boolean;
}) {
  const setOptionsItem = useWorkspace((s) => s.setOptionsItem);
  const openRightPanel = useTabs((s) => s.openRightPanel);
  return (
    <section className={styles.settingsGroup}>
      <h4>차트 속성</h4>
      <button
        type="button"
        className={styles.linkButton}
        disabled={disabled}
        onClick={() => {
          setOptionsItem(item);
          openRightPanel("options");
        }}
      >
        <SlidersHorizontal size={12} aria-hidden="true" />{" "}
        {item.options ? "개별 속성 편집 (정함)" : "개별 속성 편집"}
      </button>
    </section>
  );
}
