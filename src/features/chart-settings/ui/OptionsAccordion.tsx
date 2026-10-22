"use client";

import { Accordion } from "@base-ui/react/accordion";
import {
  Calculator,
  ChevronDown,
  Crosshair,
  Grid3x3,
  Hash,
  ListChecks,
  type LucideIcon,
  Maximize2,
  MessageSquareText,
  Paintbrush,
  Shapes,
  Sigma,
  Square,
  Tag,
  TrendingUp,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";
import type {
  ChartOptions,
  ChartOptionsPatch,
  OptionSection,
} from "@/entities/chart/model/chart-options";
import {
  hasSection,
  removeSection,
  SECTION_LABELS,
} from "../model/option-fields";
import { OptionSectionForm } from "./OptionSectionForm";
import styles from "./OptionsAccordion.module.css";

const SECTION_ICONS: Record<OptionSection, LucideIcon> = {
  title: Type,
  axes: Grid3x3,
  legend: ListChecks,
  panel: Square,
  palette: Paintbrush,
  shape: Shapes,
  size: Maximize2,
  pointLabel: Tag,
  score: Sigma,
  prediction: TrendingUp,
  value: Hash,
  focus: Crosshair,
  tooltip: MessageSquareText,
  expression: Calculator,
};

/**
 * 속성 구역을 접고 펴는 목록. 스크롤 하나로 내려가고, 여러 구역을 함께 펼 수 있다.
 * 머리의 점은 이 범위(공통 또는 item)에서 정한 값이 있다는 표시다.
 */
export function OptionsAccordion({
  sections,
  supported,
  resolved,
  patch,
  disabled,
  onChange,
  resetLabel,
  extras,
}: {
  sections: readonly OptionSection[];
  /** 차트가 이 구역의 속성을 쓰는지. 아니면 extras만 보인다. */
  supported: (section: OptionSection) => boolean;
  resolved: ChartOptions;
  patch: ChartOptionsPatch | undefined;
  disabled: boolean;
  onChange: (next: ChartOptionsPatch | undefined) => void;
  resetLabel: string;
  /** 구역 안 맨 위에 붙는 내용 (속성 모델 밖에 저장하는 같은 구역 설정) */
  extras?: Partial<Record<OptionSection, ReactNode>>;
}) {
  return (
    <Accordion.Root
      multiple
      defaultValue={sections.slice(0, 1)}
      className={styles.list}
    >
      {sections.map((section) => {
        const Icon = SECTION_ICONS[section];
        const changed = hasSection(patch, section);
        return (
          <Accordion.Item key={section} value={section} className={styles.item}>
            <Accordion.Header className={styles.header}>
              <Accordion.Trigger className={styles.trigger}>
                <Icon size={14} aria-hidden="true" />
                <span className={styles.name}>{SECTION_LABELS[section]}</span>
                {changed && (
                  <>
                    <span className={styles.changedDot} aria-hidden="true" />
                    <span className={styles.srOnly}>바꾼 값 있음</span>
                  </>
                )}
                <ChevronDown
                  size={14}
                  className={styles.chevron}
                  aria-hidden="true"
                />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel className={styles.panel}>
              <OptionSectionForm
                section={section}
                resolved={resolved}
                patch={patch}
                disabled={disabled}
                onChange={onChange}
                onReset={
                  changed
                    ? () => onChange(removeSection(patch, section))
                    : undefined
                }
                resetLabel={resetLabel}
                showFields={supported(section)}
                showHeading={false}
              >
                {extras?.[section]}
              </OptionSectionForm>
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
