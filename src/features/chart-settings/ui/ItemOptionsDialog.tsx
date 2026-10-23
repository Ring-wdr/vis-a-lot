"use client";

import { type ReactNode, type SyntheticEvent, useId, useState } from "react";
import { createPortal } from "react-dom";
import { type FieldPath, useFormContext } from "react-hook-form";
import {
  OPTION_SECTIONS,
  type OptionSection,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { button, linkButton } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { getPath, hasSection, sectionPaths } from "../model/option-fields";
import {
  type OptionsBase,
  type OptionsFormValues,
  useOptionsPatch,
} from "../model/options-form";
import { OptionSectionForm } from "./OptionSectionForm";
import { type MenuTarget, resolveTarget, SectionMenu } from "./SectionMenu";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();

type ItemOptionsProps = OptionsBase & {
  itemKey: string;
  label: string;
  /**
   * 속성 모델 밖에 저장하는 같은 구역의 item 설정(legend 위치는 범례, 색은 팔레트). 그 구역의 필드 표 위에 붙는다.
   * 차트가 쓰지 않는 구역이어도 내용이 있으면 메뉴에 둔다.
   */
  extras?: Partial<Record<OptionSection, ReactNode>>;
  /** 바꾼 것을 서버로 보내고 닫는다. */
  onConfirm: () => void;
  /** 보내지 않고 닫는다 (취소, Esc). */
  onCancel: () => void;
};

/** React 이벤트가 팝업 밖(item 카드: 휠 = 페이지 넘김, 더블 클릭 = 크게 보기, 우클릭 메뉴)으로 올라가지 않게 한다. */
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * item 속성 팝업. 전체 설정과 같은 구역 폼을 item 범위로 열고, legend 위치·색 같은 item 설정을 그 구역에 함께 둔다.
 * 폼(react-hook-form)은 여는 쪽(item 카드)이 만들어 FormProvider로 감싼다. 확인을 누르면 여는 쪽이 한 번에 보내고,
 * 취소하면 아무것도 보내지 않는다.
 * item 카드 안에서 그려 item 상태를 그대로 받고, 화면에는 body로 portal해 카드의 overflow·투명도에 영향받지 않는다.
 */
export function ItemOptionsDialog(props: ItemOptionsProps) {
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: 이벤트 전파만 끊는 감싸개다.
    <div
      onPointerDown={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
      onWheel={stop}
    >
      <Dialog isOpen onClose={props.onCancel} className={sd.dialog()}>
        <ItemOptionsBody {...props} />
      </Dialog>
    </div>,
    document.body,
  );
}

function ItemOptionsBody({
  itemKey,
  label,
  original,
  base,
  extras = {},
  onConfirm,
  onCancel,
}: ItemOptionsProps) {
  const titleId = useId();
  const chartType = useWorkspace((s) => s.current?.spec.chartType);
  const readOnly = useWorkspace((s) => s.readOnly);
  // item을 다시 그리는 동안에는 다음 변경을 보내지 않는다 (서버가 거절한다).
  const busy = useWorkspace((s) => s.itemJobs[itemKey] !== undefined);
  const { formState, setValue } = useFormContext<OptionsFormValues>();
  const patch = useOptionsPatch({ original, base });
  const sections = OPTION_SECTIONS.filter(
    (s) => supportsOption(chartType, s) || extras[s] !== undefined,
  );
  const [menu, setMenu] = useState<MenuTarget>();
  const active = resolveTarget(menu, sections);

  // 모든 구역을 공통 속성으로 돌린다. 필드의 Controller가 다시 그려지도록 필드마다 넣는다.
  const followAll = () => {
    for (const section of OPTION_SECTIONS)
      for (const path of sectionPaths(section))
        setValue(
          `options.${path}` as FieldPath<OptionsFormValues>,
          getPath(base, path) as never,
          { shouldDirty: true },
        );
    setValue("resetSections", [...OPTION_SECTIONS], { shouldDirty: true });
  };

  return (
    <form
      className={sd.body()}
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm();
      }}
    >
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
              original={original}
              base={base}
              disabled={readOnly}
              resetLabel="이 구역은 공통 속성 따르기"
              showFields={supportsOption(chartType, active.section)}
            >
              {extras[active.section]}
            </OptionSectionForm>
          )}
          <p className="mt-2.5 text-xs text-fg-muted">
            확인을 누르면 이 item만 다시 그립니다. 전체 설정에서 바꾼 공통
            속성으로 다시 그리면 item별 속성은 모두 공통 속성으로 바뀝니다.
          </p>
        </div>
      </div>
      <div className={dialogActions}>
        {patch && !readOnly && (
          <button
            type="button"
            className={linkButton({ class: "mr-auto self-center" })}
            onClick={followAll}
          >
            모두 공통 속성 따르기
          </button>
        )}
        <button type="button" className={button()} onClick={onCancel}>
          취소
        </button>
        <button
          type="submit"
          className={button({ variant: "primary" })}
          disabled={!formState.isDirty || busy || readOnly}
          title={busy ? "다시 그리는 중에는 바꿀 수 없습니다" : undefined}
        >
          확인
        </button>
      </div>
    </form>
  );
}
