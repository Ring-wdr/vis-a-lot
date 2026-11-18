"use client";

import { t } from "@lingui/core/macro";
import { intlLocale } from "@vis-a-lot/shared/lib/i18n";
import { useCallback } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { api } from "@/shared/api/api";
import type { SelectionValuesResponse } from "@/shared/api/types";
import "../config/messages";

/** 복사할 글자: 값 하나에 한 줄 */
export function selectionValuesText(values: readonly string[]) {
  return values.join("\n");
}

/**
 * 복사한 뒤 알릴 문장. 다 담았으면 알리지 않는다(undefined).
 * 값이 없으면 복사하지 않았다고, 1,000개에서 잘렸으면 앞의 몇 개만 담았다고 알린다.
 */
export function copyNotice({
  values,
  total,
  truncated,
}: Pick<SelectionValuesResponse, "values" | "total" | "truncated">):
  | string
  | undefined {
  if (values.length === 0) return t`복사할 선택 값이 없습니다.`;
  if (!truncated) return undefined;
  const shown = values.length.toLocaleString(intlLocale());
  const all = total.toLocaleString(intlLocale());
  return t({
    message: `선택 값이 ${all}개라 앞의 ${shown}개만 복사했습니다.`,
    comment:
      "all: 겹치지 않는 선택 값의 전체 수, shown: 복사한 수 (최대 1,000)",
  });
}

/**
 * 우클릭 메뉴의 `선택 값 복사`: 서버가 묶은 선택 값(selection-values)을 줄바꿈으로 이어 클립보드에 쓴다.
 * 잘렸거나 값이 없거나 실패하면 작업 화면 알림으로 알린다. 진행 상태를 그리지 않으므로 query 상태 없이 함수만 돌려준다
 * (item 카드가 복사 때마다 다시 그려지지 않게).
 */
export function useCopySelectionValues(chartId: string, itemKey: string) {
  const notify = useWorkspace((s) => s.notify);
  return useCallback(async () => {
    try {
      const result = await api.selectionValues(chartId, itemKey);
      if (result.values.length > 0)
        await navigator.clipboard.writeText(selectionValuesText(result.values));
      const notice = copyNotice(result);
      if (notice) notify(notice);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      notify(t`선택 값을 복사하지 못했습니다: ${reason}`);
    }
  }, [chartId, itemKey, notify]);
}
