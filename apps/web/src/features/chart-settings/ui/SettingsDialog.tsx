"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { overlay } from "overlay-kit";
import { type ReactNode, useId, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import {
  type ChartOptions,
  type ChartOptionsPatch,
  mergeOptions,
  OPTION_SECTIONS,
  type OptionSection,
  supportsOption,
  useDefaultOptions,
} from "@/entities/chart/model/chart-options";
import {
  useWorkspace,
  useWorkspaceStore,
  WorkspaceScope,
} from "@/entities/workspace/model/workspace-scope";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { useDatasetSchema, useDatasetState } from "@/shared/api/queries";
import type { ChartSpec } from "@/shared/api/types";
import { button } from "@/shared/ui/button";
import { Dialog, dialogActions } from "@/shared/ui/Dialog";
import "../config/messages";
import {
  type CommonSettingsForm,
  commonFormValues,
  commonFromForm,
} from "../model/common-settings-form";
import {
  checkLimitLines,
  limitSourceOf,
  usesControlLimit,
} from "../model/control-limit-form";
import { orderSourceOf } from "../model/order-values";
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
const SECTION_EXTRAS: Partial<
  Record<
    OptionSection,
    (props: { draft: ChartSpec; readOnly: boolean }) => ReactNode
  >
> = {
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

function SettingsBody({
  initial,
  onClose,
}: {
  initial: MenuTarget | undefined;
  onClose: () => void;
}) {
  const { t } = useLingui();
  const titleId = useId();
  const store = useWorkspaceStore();
  // 구역 폼들은 store를 읽지 않는다. 이 팝업이 고른 값을 props로 내려 준다.
  const draft = useWorkspace((s) => s.draft);
  const chartType = draft.chartType;
  const readOnly = useWorkspace((s) => s.readOnly);
  const updateDraft = useWorkspace((s) => s.updateDraft);
  const setShowNearest = useWorkspace((s) => s.setShowNearest);
  // 서버 draw와 같은 기본값. 폼의 '기본값'과 되돌리기 기준이 된다.
  const defaults = useDefaultOptions(chartType);
  // 순서 필드(legend·범주 순서)는 다음 draw에 쓸 데이터셋·컬럼의 값을 늘어놓는다.
  const datasetReady = useDatasetState(draft.dataset).data === "ready";
  const orderSource = orderSourceOf(draft, datasetReady);
  // 관리선 선 목록은 다음 draw의 차트·x·숫자 컬럼에 맞춰 고르고 검사한다.
  const columns = useDatasetSchema(draft.dataset).data?.columns;
  const limitSource = useMemo(
    () => limitSourceOf(draft, columns),
    [draft, columns],
  );
  // 열 때의 값. 폼은 이 값에서 시작하고, 확인을 누르면 바뀐 것만 draft로 옮긴다.
  const [opened] = useState(() => {
    const { draft, showNearest } = store.getState();
    const options = mergeOptions<ChartOptions>(
      defaults,
      draft.common.options as ChartOptionsPatch | undefined,
    );
    return {
      common: draft.common,
      options,
      values: commonFormValues(draft.common, options, {
        splitSeparator: draft.splitSeparator,
        showNearest,
      }),
    };
  });
  const form = useForm<CommonSettingsForm>({ defaultValues: opened.values });
  const { isDirty, dirtyFields } = form.formState;
  // 서버가 거절할 관리선이면 확인을 막고 까닭을 title로 보인다 (다시 보기 전용은 저장하지 않는다).
  const limitLines = useWatch({
    control: form.control,
    name: "options.controlLimit.lines",
  });
  const blocked = readOnly
    ? undefined
    : checkLimitLines(limitLines, limitSource).blocked;

  const confirm = form.handleSubmit((values) => {
    setShowNearest(values.showNearest);
    // 다시 보기 전용 화면에서는 화면 표시(가까운 점)만 바꾼다.
    if (readOnly) return onClose();
    // 공통 속성은 다음 draw에 적용된다. 그린 차트는 draw를 누를 때까지 그대로다.
    updateDraft({
      common: commonFromForm(values, {
        opened: opened.options,
        original: opened.common,
        base: defaults,
      }),
      ...(dirtyFields.splitSeparator && {
        splitSeparator: values.splitSeparator,
      }),
    });
    onClose();
  });

  // 차트 속성 구역은 고른 차트 종류가 쓰는 것만 보인다. 관리선은 분포 line에서도 끈다.
  const sections = OPTION_SECTIONS.filter(
    (s) =>
      (supportsOption(chartType, s) &&
        (s !== "controlLimit" || usesControlLimit(draft))) ||
      ALWAYS_SHOWN.includes(s),
  );
  const [menu, setMenu] = useState<MenuTarget | undefined>(initial);
  const active = resolveTarget(menu, sections) ?? { section: sections[0] };
  const Extra = SECTION_EXTRAS[active.section];

  return (
    <FormProvider {...form}>
      <form className={sd.body()} onSubmit={confirm}>
        <h2 id={titleId} className={sd.title()}>
          <Trans>전체 설정</Trans>
        </h2>
        <div className={sd.layout()}>
          <SectionMenu
            label={t`설정 메뉴`}
            sections={sections}
            active={active}
            onSelect={setMenu}
          />
          <div className={sd.content()}>
            <CommonOptionSettings
              key={`${active.section}-${active.part}`}
              section={active.section}
              part={active.part}
              chartType={chartType}
              orderSource={orderSource}
              limitSource={limitSource}
              supported={supportsOption(chartType, active.section)}
              original={opened.common.options as ChartOptionsPatch | undefined}
              defaults={defaults}
              readOnly={readOnly}
            >
              {Extra && <Extra draft={draft} readOnly={readOnly} />}
            </CommonOptionSettings>
          </div>
        </div>
        <div className={dialogActions}>
          <button type="button" className={button()} onClick={onClose}>
            <Trans context="dialog button">취소</Trans>
          </button>
          <button
            type="submit"
            className={button({ variant: "primary" })}
            disabled={!isDirty || blocked !== undefined}
            title={blocked}
          >
            <Trans context="dialog button">확인</Trans>
          </button>
        </div>
      </form>
    </FormProvider>
  );
}

/**
 * 전체 설정 팝업. overlay는 본문 밖에서 그려지므로 연 탭의 작업 상태(store)를 넘겨받아
 * 그 범위 안에서 설정을 읽고 바꾼다. 확인을 누르면 다음 draw에 쓸 설정(draft)이 바뀌고, 차트에는 draw를
 * 눌러야 적용된다. 취소·Esc는 바꾼 것을 버린다. initial을 주면 그 구역을 연다 (도구 줄의 관리선 버튼).
 */
export function openSettingsDialog(
  store: WorkspaceStore,
  initial?: MenuTarget,
) {
  overlay.open(({ isOpen, close, unmount }) => (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      onExited={unmount}
      className={sd.dialog()}
    >
      <WorkspaceScope store={store}>
        <SettingsBody initial={initial} onClose={close} />
      </WorkspaceScope>
    </Dialog>
  ));
}

/** 전체 설정 팝업을 관리선 구역으로 연다. 도구 줄(chart-actions)에 넘겨 쓴다. */
export function openControlLimitSettings(store: WorkspaceStore) {
  openSettingsDialog(store, { section: "controlLimit" });
}
