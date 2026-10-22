"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState } from "@/shared/api/types";
import { showPrompt } from "@/shared/ui/AlertDialog";
import styles from "@/shared/ui/workspace.module.css";

/** 이름이 겹치지 않도록 '이름 N'에서 비어 있는 가장 작은 N을 고른다. */
function nextName(prefix: string, taken: string[]) {
  for (let n = 1; ; n++) {
    const name = `${prefix} ${n}`;
    if (!taken.includes(name)) return name;
  }
}

/** 이름 목록을 펼치는 하위 메뉴. 목록이 비면 메뉴 자체를 막는다. */
function NamedSubmenu({
  label,
  names,
  disabled,
  onSelect,
}: {
  label: string;
  names: string[];
  disabled: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <ContextMenu.SubmenuRoot>
      <ContextMenu.SubmenuTrigger
        className={styles.menuItem}
        disabled={disabled || names.length === 0}
      >
        {label}
        <ChevronRight size={13} aria-hidden="true" />
      </ContextMenu.SubmenuTrigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={styles.menuPositioner}>
          <ContextMenu.Popup className={styles.menu}>
            {names.map((name) => (
              <ContextMenu.Item
                key={name}
                className={styles.menuItem}
                onClick={() => onSelect(name)}
              >
                {name}
              </ContextMenu.Item>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.SubmenuRoot>
  );
}

/**
 * item 우클릭 메뉴: 선택 영역을 즐겨찾기나 새 범례로 남기고, 남긴 즐겨찾기를 다시 선택한다.
 * 다시 보기 전용 화면이나 다시 그리는 중에는 메뉴를 열지 않는다.
 */
export function ItemContextMenu({
  item,
  disabled,
  className,
  onAction,
  children,
}: {
  item: ItemState;
  disabled: boolean;
  className: string;
  onAction: (action: ItemAction) => void;
  children: ReactNode;
}) {
  const selected = item.selectedCount !== undefined;
  const favorites = item.favorites.map((f) => f.name);
  const groups = item.legendGroups.map((g) => g.name);

  const addFavorite = async () => {
    const name = await showPrompt("즐겨찾기 이름", {
      defaultValue: nextName("즐겨찾기", favorites),
      confirmLabel: "추가",
    });
    if (name) onAction({ type: "addFavorite", name });
  };

  const addLegendGroup = async () => {
    const name = await showPrompt("새 범례 이름", {
      defaultValue: nextName("선택", groups),
      confirmLabel: "만들기",
    });
    if (name) onAction({ type: "addLegendGroup", name });
  };

  return (
    <ContextMenu.Root disabled={disabled}>
      <ContextMenu.Trigger className={className}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={styles.menuPositioner}>
          <ContextMenu.Popup className={styles.menu}>
            <ContextMenu.Group>
              <ContextMenu.GroupLabel className={styles.menuLabel}>
                {selected
                  ? `선택 ${item.selectedCount?.toLocaleString()}개`
                  : "선택한 영역 없음"}
              </ContextMenu.GroupLabel>
              <ContextMenu.Item
                className={styles.menuItem}
                disabled={!selected}
                onClick={addFavorite}
              >
                즐겨찾기에 추가…
              </ContextMenu.Item>
              <ContextMenu.Item
                className={styles.menuItem}
                disabled={!selected}
                onClick={addLegendGroup}
              >
                새 범례…
              </ContextMenu.Item>
              <ContextMenu.Item
                className={styles.menuItem}
                disabled={!selected}
                onClick={() => onAction({ type: "select", region: null })}
              >
                선택 해제
              </ContextMenu.Item>
            </ContextMenu.Group>
            <ContextMenu.Separator className={styles.menuSeparator} />
            <NamedSubmenu
              label="즐겨찾기 선택"
              names={favorites}
              disabled={disabled}
              onSelect={(name) => {
                const favorite = item.favorites.find((f) => f.name === name);
                if (favorite)
                  onAction({ type: "select", region: favorite.region });
              }}
            />
            <NamedSubmenu
              label="즐겨찾기 삭제"
              names={favorites}
              disabled={disabled}
              onSelect={(name) => onAction({ type: "removeFavorite", name })}
            />
            <NamedSubmenu
              label="새 범례 삭제"
              names={groups}
              disabled={disabled}
              onSelect={(name) => onAction({ type: "removeLegendGroup", name })}
            />
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
