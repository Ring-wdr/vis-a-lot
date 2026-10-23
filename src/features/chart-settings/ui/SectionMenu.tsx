"use client";

import type { OptionSection } from "@/entities/chart/model/chart-options";
import { SECTION_LABELS, SECTION_PARTS } from "../model/option-fields";
import { SECTION_ICONS } from "./OptionSettings";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();

/** 메뉴에서 고른 곳. 하위 항목이 있는 구역(축)은 part로 X축·Y축을 고른다. */
export type MenuTarget = { section: OptionSection; part?: string };

/** 고른 구역이 목록에 없으면(차트를 바꿨을 때) 첫 구역으로 돌린다. */
export function resolveTarget(
  target: MenuTarget | undefined,
  sections: readonly OptionSection[],
): MenuTarget | undefined {
  if (target && sections.includes(target.section)) return target;
  return sections[0] && { section: sections[0] };
}

/**
 * 설정 팝업 왼쪽의 구역 메뉴. 필드가 많은 구역은 하위 항목을 들여 써서 함께 보이고,
 * 구역을 누르면 첫 하위 항목을 연다.
 */
export function SectionMenu({
  label,
  sections,
  active,
  onSelect,
  marked,
}: {
  label: string;
  sections: readonly OptionSection[];
  active: MenuTarget | undefined;
  onSelect: (target: MenuTarget) => void;
  /** 구역 이름 뒤에 •를 붙일지 (item에 따로 정한 구역) */
  marked?: (section: OptionSection) => boolean;
}) {
  return (
    <nav className={sd.menu()} aria-label={label}>
      {sections.map((id) => {
        const Icon = SECTION_ICONS[id];
        const parts = SECTION_PARTS[id];
        const current = active?.section === id;
        return (
          <div key={id} className="flex flex-col gap-0.5">
            <button
              type="button"
              className={sd.menuItem()}
              // 하위 항목이 있으면 고른 하위 항목이 현재 위치다.
              aria-current={(current && !parts) || undefined}
              aria-expanded={parts ? current : undefined}
              onClick={() => onSelect({ section: id, part: parts?.[0].id })}
            >
              <Icon size={14} aria-hidden="true" />
              {SECTION_LABELS[id]}
              {marked?.(id) && " •"}
            </button>
            {current &&
              parts?.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  className={sd.menuItem({ class: "py-1.5 pl-8" })}
                  aria-current={
                    (active?.part ?? parts[0].id) === part.id || undefined
                  }
                  onClick={() => onSelect({ section: id, part: part.id })}
                >
                  {part.label}
                </button>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
