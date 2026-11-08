"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState } from "@/shared/api/types";
import { defineMessages, intlLocale, useT } from "@/shared/lib/i18n";
import { showPrompt } from "@/shared/ui/AlertDialog";

const messages = defineMessages({
  ko: {
    favoriteName: "즐겨찾기 이름",
    favoritePrefix: "즐겨찾기",
    add: "추가",
    legendName: "새 범례 이름",
    legendPrefix: "선택",
    create: "만들기",
    selected: (n: string) => `선택 ${n}개`,
    noSelection: "선택한 영역 없음",
    addFavorite: "즐겨찾기에 추가…",
    newLegend: "새 범례…",
    clearSelection: "선택 해제",
    selectFavorite: "즐겨찾기 선택",
    removeFavorite: "즐겨찾기 삭제",
    restoreDeleted: "지운 점 모두 되돌리기",
    removeLegend: "새 범례 삭제",
  },
  en: {
    favoriteName: "Favorite name",
    favoritePrefix: "Favorite",
    add: "Add",
    legendName: "New legend name",
    legendPrefix: "Selection",
    create: "Create",
    selected: (n: string) => `${n} selected`,
    noSelection: "No selection",
    addFavorite: "Add to favorites…",
    newLegend: "New legend…",
    clearSelection: "Clear selection",
    selectFavorite: "Select favorite",
    removeFavorite: "Delete favorite",
    restoreDeleted: "Restore all erased points",
    removeLegend: "Delete new legend",
  },
});

// item 우클릭 메뉴 (Base UI ContextMenu)
const menuPositioner = "z-menu outline-0";
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
  const text = useT(messages);
  const selected = item.selectedCount !== undefined;
  const favorites = item.favorites.map((f) => f.name);
  const groups = item.legendGroups.map((g) => g.name);

  const addFavorite = async () => {
    const name = await showPrompt(text.favoriteName, {
      defaultValue: nextName(text.favoritePrefix, favorites),
      confirmLabel: text.add,
    });
    if (name) onAction({ type: "addFavorite", name });
  };

  const addLegendGroup = async () => {
    const name = await showPrompt(text.legendName, {
      defaultValue: nextName(text.legendPrefix, groups),
      confirmLabel: text.create,
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
              <ContextMenu.GroupLabel className="px-2 py-1 text-xs text-fg-secondary">
                {selected
                  ? text.selected(
                      (item.selectedCount ?? 0).toLocaleString(intlLocale()),
                    )
                  : text.noSelection}
              </ContextMenu.GroupLabel>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={addFavorite}
              >
                {text.addFavorite}
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={addLegendGroup}
              >
                {text.newLegend}
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={() => onAction({ type: "select", region: null })}
              >
                {text.clearSelection}
              </ContextMenu.Item>
            </ContextMenu.Group>
            <ContextMenu.Separator className="my-1 h-px bg-line" />
            <NamedSubmenu
              label={text.selectFavorite}
              names={favorites}
              disabled={disabled}
              onSelect={(name) => {
                const favorite = item.favorites.find((f) => f.name === name);
                if (favorite)
                  onAction({ type: "select", region: favorite.region });
              }}
            />
            <NamedSubmenu
              label={text.removeFavorite}
              names={favorites}
              disabled={disabled}
              onSelect={(name) => onAction({ type: "removeFavorite", name })}
            />
            <ContextMenu.Item
              className={menuItem}
              disabled={item.deletionCount === 0}
              onClick={() => onAction({ type: "clearDeletions" })}
            >
              {text.restoreDeleted}
            </ContextMenu.Item>
            <NamedSubmenu
              label={text.removeLegend}
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
