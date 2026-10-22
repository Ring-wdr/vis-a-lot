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
  const setOptionsScope = useWorkspace((s) => s.setOptionsScope);
  // 같은 item을 다시 고르면 아직 보내지 않은 값을 덮어쓰지 않는다.
  const unsent = useWorkspace(
    (s) => s.optionsItem?.key === item.key && s.optionsItem.dirty === true,
  );
  const openRightPanel = useTabs((s) => s.openRightPanel);
  return (
    <section className={styles.settingsGroup}>
      <h4>차트 속성</h4>
      <button
        type="button"
        className={styles.linkButton}
        disabled={disabled}
        onClick={() => {
          if (unsent) setOptionsScope("item");
          else setOptionsItem(item);
          openRightPanel("options");
        }}
      >
        <SlidersHorizontal size={12} aria-hidden="true" />{" "}
        {item.options ? "개별 속성 편집 (정함)" : "개별 속성 편집"}
      </button>
    </section>
  );
}
