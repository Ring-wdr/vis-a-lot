"use client";

import { ContextMenu } from "@base-ui/react/context-menu";
import { Trans, useLingui } from "@lingui/react/macro";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemAction } from "@/features/item-actions/model/item-actions";
import type { ItemState } from "@/shared/api/types";
import { intlLocale } from "@/shared/lib/i18n";
import { showPrompt } from "@/shared/ui/AlertDialog";
import "../config/messages";

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
  const { t } = useLingui();
  const selected = item.selectedCount !== undefined;
  const favorites = item.favorites.map((f) => f.name);
  const groups = item.legendGroups.map((g) => g.name);
  const count = (item.selectedCount ?? 0).toLocaleString(intlLocale());

  const addFavorite = async () => {
    const name = await showPrompt(t`즐겨찾기 이름`, {
      defaultValue: nextName(
        t({
          message: "즐겨찾기",
          context: "default favorite name",
          comment: "새 즐겨찾기 이름의 앞부분 (뒤에 번호가 붙는다)",
        }),
        favorites,
      ),
      confirmLabel: t({ message: "추가", context: "add favorite button" }),
    });
    if (name) onAction({ type: "addFavorite", name });
  };

  const addLegendGroup = async () => {
    const name = await showPrompt(t`새 범례 이름`, {
      defaultValue: nextName(
        t({
          message: "선택",
          context: "default legend group name",
          comment: "새 범례 이름의 앞부분 (뒤에 번호가 붙는다)",
        }),
        groups,
      ),
      confirmLabel: t({ message: "만들기", context: "create legend button" }),
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
                {selected ? (
                  <Trans comment="count: 선택한 점 수">선택 {count}개</Trans>
                ) : (
                  <Trans>선택한 영역 없음</Trans>
                )}
              </ContextMenu.GroupLabel>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={addFavorite}
              >
                <Trans>즐겨찾기에 추가…</Trans>
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={addLegendGroup}
              >
                <Trans>새 범례…</Trans>
              </ContextMenu.Item>
              <ContextMenu.Item
                className={menuItem}
                disabled={!selected}
                onClick={() => onAction({ type: "select", region: null })}
              >
                <Trans>선택 해제</Trans>
              </ContextMenu.Item>
            </ContextMenu.Group>
            <ContextMenu.Separator className="my-1 h-px bg-line" />
            <NamedSubmenu
              label={t`즐겨찾기 선택`}
              names={favorites}
              disabled={disabled}
              onSelect={(name) => {
                const favorite = item.favorites.find((f) => f.name === name);
                if (favorite)
                  onAction({ type: "select", region: favorite.region });
              }}
            />
            <NamedSubmenu
              label={t`즐겨찾기 삭제`}
              names={favorites}
              disabled={disabled}
              onSelect={(name) => onAction({ type: "removeFavorite", name })}
            />
            <ContextMenu.Item
              className={menuItem}
              disabled={item.deletionCount === 0}
              onClick={() => onAction({ type: "clearDeletions" })}
            >
              <Trans>지운 점 모두 되돌리기</Trans>
            </ContextMenu.Item>
            <NamedSubmenu
              label={t`새 범례 삭제`}
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
