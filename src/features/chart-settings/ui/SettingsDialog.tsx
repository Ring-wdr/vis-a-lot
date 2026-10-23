"use client";

import { overlay } from "overlay-kit";
import { type ReactNode, useId, useState } from "react";
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
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { ColorSettings } from "./ColorSettings";
import { LegendSettings } from "./LegendSettings";
import { CommonOptionSettings } from "./OptionSettings";
import { type MenuTarget, resolveTarget, SectionMenu } from "./SectionMenu";
import { SplitSettings } from "./SplitSettings";
import { settingsDialog } from "./settings-dialog-styles";
import { TooltipSettings } from "./TooltipSettings";

const sd = settingsDialog();

/**
 * 속성 모델(common.options) 밖에 저장하지만 원본에서 같은 구역에 있는 설정. 그 구역의 필드 표 위에 붙인다.
 * 저장 위치는 예전 history·공유 링크와 맞추려고 그대로 둔다.
 */
const SECTION_EXTRAS: Partial<Record<OptionSection, () => ReactNode>> = {
  // Title · Concat String: split 조합 이름을 잇는 문자 (spec.splitSeparator)
  title: SplitSettings,
  // Palette · Default Color, Name/Color (common.color, common.legendColors)
  palette: ColorSettings,
  // Legend · Position (common.legendPosition)
  legend: LegendSettings,
  // 화면 툴팁의 가까운 점 표시 (작업 화면 상태)
  tooltip: TooltipSettings,
};

/** 차트가 이 구역을 쓰지 않아도 메뉴에 두는 구역. legend 위치는 legend를 그리는 모든 차트에 쓴다. */
const ALWAYS_SHOWN: readonly OptionSection[] = ["legend"];

function SettingsBody({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const chartType = useWorkspace((s) => s.draft.chartType);
  // 차트 속성 구역은 고른 차트 종류가 쓰는 것만 보인다.
  const sections = OPTION_SECTIONS.filter(
    (s) => supportsOption(chartType, s) || ALWAYS_SHOWN.includes(s),
  );
  const [menu, setMenu] = useState<MenuTarget>();
  const active = resolveTarget(menu, sections) ?? { section: sections[0] };
  const Extra = SECTION_EXTRAS[active.section];

  return (
    <div className={sd.body()}>
      <h2 id={titleId} className={sd.title()}>
        전체 설정
      </h2>
      <div className={sd.layout()}>
        <SectionMenu
          label="설정 메뉴"
          sections={sections}
          active={active}
          onSelect={setMenu}
        />
        <div className={sd.content()}>
          <CommonOptionSettings
            key={`${active.section}-${active.part}`}
            section={active.section}
            part={active.part}
            supported={supportsOption(chartType, active.section)}
          >
            {Extra && <Extra />}
          </CommonOptionSettings>
        </div>
      </div>
      <div className={dialogActions}>
        <button type="button" className={button()} onClick={onClose}>
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
      className={sd.dialog()}
    >
      <WorkspaceScope store={store}>
        <SettingsBody onClose={close} />
      </WorkspaceScope>
    </Dialog>
  ));
}
