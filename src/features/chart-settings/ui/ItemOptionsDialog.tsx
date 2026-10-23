"use client";

import { SlidersHorizontal } from "lucide-react";
import { overlay } from "overlay-kit";
import { useId, useState } from "react";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  DEFAULT_OPTIONS,
  mergeOptions,
  OPTION_SECTIONS,
  type OptionSection,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import {
  useWorkspace,
  useWorkspaceStore,
  WorkspaceScope,
} from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { button, linkButton } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import { settingsStyles } from "@/shared/ui/settings-styles";
import {
  hasSection,
  removeSection,
  SECTION_LABELS,
} from "../model/option-fields";
import { OptionSectionForm } from "./OptionSectionForm";
import { SECTION_ICONS } from "./OptionSettings";
import { settingsDialog } from "./settings-dialog-styles";

const sd = settingsDialog();
const s = settingsStyles();

type ItemOptionsProps = {
  itemKey: string;
  label: string;
  /** item에 따로 정한 속성 (ItemState.options) */
  options: ChartOptionsPatch | undefined;
  /** item 속성 전체를 바꾼다. null이면 지우고 공통 속성을 따른다. */
  onChange: (options: ChartOptionsPatch | null) => void;
};

/**
 * item 설정 팝업의 "차트 속성" 버튼. 전체 설정과 같은 구역 폼을 item 범위로 연다.
 * item 조작(onChange)은 그 item 카드가 가진 요청을 그대로 쓴다.
 */
export function ItemOptionsButton({
  disabled,
  ...props
}: ItemOptionsProps & { disabled: boolean }) {
  const store = useWorkspaceStore();
  return (
    <section className={s.group()}>
      <h4 className={s.groupTitle()}>차트 속성</h4>
      <button
        type="button"
        className={linkButton()}
        disabled={disabled}
        onClick={() => openItemOptionsDialog(store, props)}
      >
        <SlidersHorizontal size={12} aria-hidden="true" />{" "}
        {props.options ? "개별 속성 편집 (정함)" : "개별 속성 편집"}
      </button>
    </section>
  );
}

function openItemOptionsDialog(store: WorkspaceStore, props: ItemOptionsProps) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={sd.dialog()}
    >
      <WorkspaceScope store={store}>
        <ItemOptionsBody {...props} onClose={close} />
      </WorkspaceScope>
    </Dialog>
  ));
}

function ItemOptionsBody({
  itemKey,
  label,
  options: initial,
  onChange,
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
  const sections = OPTION_SECTIONS.filter((s) => supportsOption(chartType, s));
  const [menu, setMenu] = useState<OptionSection | undefined>(sections[0]);
  const active = menu && sections.includes(menu) ? menu : sections[0];

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
        <nav className={sd.menu()} aria-label="속성 메뉴">
          {sections.map((id) => {
            const Icon = SECTION_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                className={sd.menuItem()}
                aria-current={active === id || undefined}
                onClick={() => setMenu(id)}
              >
                <Icon size={14} aria-hidden="true" />
                {SECTION_LABELS[id]}
                {hasSection(patch, id) && " •"}
              </button>
            );
          })}
        </nav>
        <div className={sd.content()}>
          {active && (
            <OptionSectionForm
              key={active}
              section={active}
              resolved={resolved}
              patch={patch}
              disabled={readOnly || busy}
              onChange={save}
              onReset={
                hasSection(patch, active)
                  ? () => save(removeSection(patch, active))
                  : undefined
              }
              resetLabel="이 구역은 공통 속성 따르기"
            />
          )}
          <p className="text-fg-muted text-xs">
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
