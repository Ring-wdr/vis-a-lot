"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState } from "@/shared/api/types";
import { showPrompt } from "@/shared/ui/AlertDialog";

// item 우클릭 메뉴 (Base UI ContextMenu)
const menuPositioner = "z-20 outline-0";
const menu =
  "min-w-45 rounded-lg border border-line bg-elevated p-1 text-ui shadow-xl outline-0";
const menuItem =
  "flex cursor-default select-none items-center justify-between gap-3 rounded-sm px-2 py-1.5 outline-0 data-disabled:opacity-40 data-highlighted:bg-accent-soft data-popup-open:bg-accent-soft data-highlighted:text-accent data-popup-open:text-accent";

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
        className={menuItem}
        disabled={disabled || names.length === 0}
      >
        {label}
        <ChevronRight size={13} aria-hidden="true" />
      </ContextMenu.SubmenuTrigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={menuPositioner}>
          <ContextMenu.Popup className={menu}>
            {names.map((name) => (
              <ContextMenu.Item
                key={name}
                className={menuItem}
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
        <ContextMenu.Positioner className={menuPositioner}>
          <ContextMenu.Popup className={menu}>
            <ContextMenu.Group>
              <ContextMenu.GroupLabel className="px-2 py-1 text-fg-secondary text-xs">
                {selected
                  ? `선택 ${item.selectedCount?.toLocaleString()}개`
                  : "선택한 영역 없음"}
              </ContextMenu.GroupLabel>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={addFavorite}
              >
                즐겨찾기에 추가…
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={addLegendGroup}
              >
                새 범례…
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={() => onAction({ type: "select", region: null })}
              >
                선택 해제
              </ContextMenu.Item>
            </ContextMenu.Group>
            <ContextMenu.Separator className="my-1 h-px bg-line" />
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
            <ContextMenu.Item
              className={menuItem}
              disabled={item.deletionCount === 0}
              onClick={() => onAction({ type: "clearDeletions" })}
            >
              지운 점 모두 되돌리기
            </ContextMenu.Item>
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
