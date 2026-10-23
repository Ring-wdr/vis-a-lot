"use client";

import { type ReactNode, type SyntheticEvent, useId, useState } from "react";
import { createPortal } from "react-dom";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
  OPTION_SECTIONS,
  type OptionSection,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { button, linkButton } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { hasSection, removeSection } from "../model/option-fields";
import { OptionSectionForm } from "./OptionSectionForm";
import { type MenuTarget, resolveTarget, SectionMenu } from "./SectionMenu";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();

type ItemOptionsProps = {
  itemKey: string;
  label: string;
  /** item에 따로 정한 속성 (ItemState.options) */
  options: ChartOptionsPatch | undefined;
  /** item 속성 전체를 바꾼다. null이면 지우고 공통 속성을 따른다. */
  onChange: (options: ChartOptionsPatch | null) => void;
  /**
   * 속성 모델 밖에 저장하는 같은 구역의 item 설정(legend 위치는 범례, 색은 팔레트). 그 구역의 필드 표 위에 붙는다.
   * 차트가 쓰지 않는 구역이어도 내용이 있으면 메뉴에 둔다.
   */
  extras?: Partial<Record<OptionSection, ReactNode>>;
};

/** React 이벤트가 팝업 밖(item 카드: 휠 = 페이지 넘김, 더블 클릭 = 크게 보기, 우클릭 메뉴)으로 올라가지 않게 한다. */
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * item 속성 팝업. 전체 설정과 같은 구역 폼을 item 범위로 열고, legend 위치·색 같은 item 설정을 그 구역에 함께 둔다.
 * item 카드 안에서 그려 item 상태를 그대로 받고, 화면에는 body로 portal해 카드의 overflow·투명도에 영향받지 않는다.
 * 연 동안만 그리므로 닫으면 상태가 사라진다.
 */
export function ItemOptionsDialog({
  onClose,
  ...props
}: ItemOptionsProps & { onClose: () => void }) {
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: 이벤트 전파만 끊는 감싸개다.
    <div
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onWheel={stop}
    >
      <Dialog isOpen onClose={onClose} className={sd.dialog()}>
        <ItemOptionsBody {...props} onClose={onClose} />
      </Dialog>
    </div>,
    document.body,
  );
}

function ItemOptionsBody({
  itemKey,
  label,
  options: initial,
  onChange,
  extras = {},
  onClose,
}: ItemOptionsProps & { onClose: () => void }) {
  const titleId = useId();
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const common = useWorkspace(
    (s) => s.current?.spec.common.options as ChartOptionsPatch | undefined,
  );
  const readOnly = useWorkspace((s) => s.readOnly);
  // item을 다시 그리는 동안에는 다음 변경을 보내지 않는다 (서버가 거절한다).
  const busy = useWorkspace((s) => s.itemJobs[itemKey] !== undefined);
  // 보낸 값을 바로 보여주도록 팝업이 열린 동안의 item 속성은 여기서 들고 있는다.
  const [patch, setPatch] = useState(initial);
  const sections = OPTION_SECTIONS.filter(
    (s) => supportsOption(chartType, s) || extras[s] !== undefined,
  );
  const [menu, setMenu] = useState<MenuTarget>();
  const active = resolveTarget(menu, sections);

  const save = (next: ChartOptionsPatch | undefined) => {
    setPatch(next);
    onChange(next ?? null);
  };
  const resolved = mergeOptions<ChartOptions>(
    mergeOptions<ChartOptions>(DEFAULT_OPTIONS, common),
    patch,
  );

  return (
    <div className={sd.body()}>
      <h2 id={titleId} className={sd.title()}>
        {label} 속성
      </h2>
      <div className={sd.layout()}>
        <SectionMenu
          label="속성 메뉴"
          sections={sections}
          active={active}
          onSelect={setMenu}
          marked={(section) => hasSection(patch, section)}
        />
        <div className={sd.content()}>
          {active && (
            <OptionSectionForm
              key={`${active.section}-${active.part}`}
              section={active.section}
              part={active.part}
              resolved={resolved}
              patch={patch}
              disabled={readOnly || busy}
              onChange={save}
              onReset={
                hasSection(patch, active.section)
                  ? () => save(removeSection(patch, active.section))
                  : undefined
              }
              resetLabel="이 구역은 공통 속성 따르기"
              showFields={supportsOption(chartType, active.section)}
            >
              {extras[active.section]}
            </OptionSectionForm>
          )}
          <p className="mt-2.5 text-xs text-fg-muted">
            바꾸면 이 item만 다시 그립니다. 전체 설정에서 공통 속성을 바꾸면
            item별 속성은 모두 공통 속성으로 바뀝니다.
          </p>
        </div>
      </div>
      <div className={dialogActions}>
        {patch && !readOnly && (
          <button
            type="button"
            className={linkButton()}
            disabled={busy}
            onClick={() => save(undefined)}
          >
            모두 공통 속성 따르기
          </button>
        )}
        <button type="button" className={button()} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
