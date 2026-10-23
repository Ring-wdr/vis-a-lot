"use client";

// 활동 보고 조건은 URL에 둔다 (?range=7d&team=…&who=…&types=a,b&tpl=…). 새로 고치거나 발표 모드로 바꿔도 유지된다.
// 프리셋 기간은 오늘 기준으로 다시 계산하고, 직접 선택만 from·to를 적는다.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ReportTemplate } from "@/feed/api/reports";
import { useToday } from "@/feed/ui/posts/post-meta";
import {
  addDays,
  isDay,
  isPreset,
  type PeriodPreset,
  presetRange,
} from "./period";

export type ActivityParams = {
  preset: PeriodPreset;
  from: string;
  to: string;
  teamId?: string;
  assigneeId?: string;
  postTypeIds: string[];
  /** 마지막으로 적용한 템플릿 */
  templateId?: string;
};

const KEYS = ["range", "from", "to", "team", "who", "types", "tpl"];

export function parseActivityParams(
  search: URLSearchParams,
  today: string,
): ActivityParams {
  const range = search.get("range");
  const preset = isPreset(range) ? range : "this-week";
  let { from, to } = presetRange(preset, today);
  if (preset === "custom") {
    const f = search.get("from");
    const t = search.get("to");
    if (isDay(f)) from = f;
    if (isDay(t)) to = t;
  }
  return {
    preset,
    from,
    to,
    teamId: search.get("team") || undefined,
    assigneeId: search.get("who") || undefined,
    postTypeIds: (search.get("types") ?? "").split(",").filter(Boolean),
    templateId: search.get("tpl") || undefined,
  };
}

export function writeActivityParams(
  search: URLSearchParams,
  p: ActivityParams,
) {
  const next = new URLSearchParams(search);
  for (const k of KEYS) next.delete(k);
  next.set("range", p.preset);
  if (p.preset === "custom") {
    next.set("from", p.from);
    next.set("to", p.to);
  }
  if (p.teamId) next.set("team", p.teamId);
  if (p.assigneeId) next.set("who", p.assigneeId);
  if (p.postTypeIds.length) next.set("types", p.postTypeIds.join(","));
  if (p.templateId) next.set("tpl", p.templateId);
  return next;
}

/** 템플릿 → 조건. 7일은 '최근 7일', 그 밖의 일수는 오늘을 끝으로 하는 직접 선택 */
export function paramsFromTemplate(
  t: ReportTemplate,
  today: string,
): ActivityParams {
  const n = t.params.rangeDays ?? 0;
  const preset: PeriodPreset = !n ? "this-week" : n === 7 ? "7d" : "custom";
  const range =
    preset === "custom"
      ? { from: addDays(today, -(n - 1)), to: today }
      : presetRange(preset, today);
  return {
    preset,
    ...range,
    teamId: t.params.teamId,
    assigneeId: t.params.assigneeId,
    postTypeIds: t.params.postTypeIds ?? [],
    templateId: t.id,
  };
}

export function useActivityParams() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const today = useToday();
  const params = useMemo(
    () => parseActivityParams(new URLSearchParams(search), today),
    [search, today],
  );
  const set = useCallback(
    (next: ActivityParams) => {
      const q = writeActivityParams(new URLSearchParams(search), next);
      router.replace(`${pathname}?${q}`, { scroll: false });
    },
    [search, router, pathname],
  );
  const update = useCallback(
    (patch: Partial<ActivityParams>) => set({ ...params, ...patch }),
    [set, params],
  );
  /** URL에 조건이 아직 없다 (처음 들어와 기본 템플릿을 적용하기 전) */
  const blank = !search.has("range");
  return { params, set, update, blank, today };
}
