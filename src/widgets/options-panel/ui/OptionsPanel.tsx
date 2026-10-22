"use client";

import { X } from "lucide-react";
import { useState } from "react";
import {
  type ChartOptionsPatch,
  supportsOption,
} from "@/entities/chart/model/chart-options";
import { useTabs } from "@/entities/workspace/model/tabs-scope";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import type { OptionsItem } from "@/entities/workspace/model/workspace-store";
import {
  type OptionTab,
  visibleTabs,
} from "@/features/chart-settings/model/option-groups";
import {
  CommonOptions,
  commonSectionShown,
} from "@/features/chart-settings/ui/CommonOptions";
import { ItemOptions } from "@/features/chart-settings/ui/ItemOptions";
import type { ChartOptionsBody } from "@/shared/api/types";
import styles from "./OptionsPanel.module.css";

/**
 * 오른쪽 차트 속성 패널. 차트를 가리지 않고 옆에서 바꾸며 결과를 본다.
 * 위에서 범위(공통 / item)와 탭(모양 / 분석)을 고르고, 탭 안의 원본 구역을 접고 펴며 한 번에 스크롤한다.
 */
export function OptionsPanel() {
  const close = useTabs((s) => s.openRightPanel);
  const draftType = useWorkspace((s) => s.draft.chartType);
  const current = useWorkspace((s) => s.current);
  const optionsItem = useWorkspace((s) => s.optionsItem);
  const scope = useWorkspace((s) => s.optionsScope);
  const setScope = useWorkspace((s) => s.setOptionsScope);
  // 다시 draw하면 다른 차트라 그 item은 더 이상 없다.
  const pickedItem =
    optionsItem && optionsItem.chartId === current?.chartId
      ? optionsItem
      : null;
  const item = scope === "item" ? pickedItem : null;
  const [tabId, setTabId] = useState<OptionTab["id"]>("look");

  // 공통은 다음 draw에 쓸 차트 종류, item은 그려 둔 차트 종류 기준이다.
  const tabs = item
    ? visibleTabs((s) => supportsOption(current?.spec.chartType, s))
    : visibleTabs((s) => commonSectionShown(draftType, s));
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];

  return (
    <section className={styles.panel} aria-label="차트 속성">
      <header className={styles.header}>
        <strong>차트 속성</strong>
        <button
          type="button"
          className={styles.close}
          aria-label="차트 속성 닫기"
          onClick={() => close(null)}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      {pickedItem && (
        <fieldset className={styles.segment}>
          <legend className={styles.srOnly}>속성 범위</legend>
          <button
            type="button"
            aria-pressed={!item}
            onClick={() => setScope("common")}
          >
            공통
          </button>
          <button
            type="button"
            aria-pressed={item !== null}
            title={pickedItem.label}
            onClick={() => setScope("item")}
          >
            개별 · {pickedItem.label}
          </button>
        </fieldset>
      )}
      <div className={styles.tabs} role="tablist" aria-label="속성 묶음">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab?.id}
            onClick={() => setTabId(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.body} role="tabpanel">
        {tab &&
          (item ? (
            <ItemScope
              key={`${item.key}:${tab.id}`}
              item={item}
              sections={tab.sections}
            />
          ) : (
            <CommonOptions key={tab.id} sections={tab.sections} />
          ))}
      </div>
    </section>
  );
}

/** item 범위: 바꾼 값은 패널에 바로 보이고, 서버에는 useItemOptionsSync가 묶어서 보낸다. */
function ItemScope({
  item,
  sections,
}: {
  item: OptionsItem;
  sections: OptionTab["sections"];
}) {
  const updateOptionsItem = useWorkspace((s) => s.updateOptionsItem);
  const busy = useWorkspace((s) => s.itemJobs[item.key] !== undefined);

  const change = (options: ChartOptionsPatch | undefined) =>
    updateOptionsItem({
      options: options as ChartOptionsBody | undefined,
      dirty: true,
    });

  return (
    <>
      <ItemOptions
        item={item}
        sections={sections}
        busy={busy}
        onChange={change}
      />
      {item.options && (
        <button
          type="button"
          className={styles.followAll}
          onClick={() => change(undefined)}
        >
          모두 공통 속성 따르기
        </button>
      )}
    </>
  );
}
