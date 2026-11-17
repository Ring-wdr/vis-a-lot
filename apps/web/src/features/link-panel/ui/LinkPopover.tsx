"use client";

import { Popover } from "@base-ui/react/popover";
import { plural } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { useLocale } from "@vis-a-lot/shared/lib/i18n";
import {
  type ReactNode,
  useCallback,
  useState,
  useSyncExternalStore,
} from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { chartKindLabel } from "@/entities/chart/lib/title";
import {
  canFollow,
  canHighlight,
  defaultLinkMode,
} from "@/entities/workspace/lib/panel-link";
import {
  useBoard,
  useBoardStore,
} from "@/entities/workspace/model/board-scope";
import type {
  BoardState,
  LinkIssue,
} from "@/entities/workspace/model/board-store";
import type { WorkspaceStore } from "@/entities/workspace/model/workspace-store";
import { useDatasetNames, useDatasetSchema } from "@/shared/api/queries";
import type {
  ChartSpec,
  ColumnInfo,
  ItemLink,
  LinkMode,
} from "@/shared/api/types";
import "../config/messages";
import { useFollowFailed } from "../model/use-follow-failed";
import { useItemLink } from "../model/use-item-link";
import {
  type ColumnsField,
  LinkSettings,
  type SourceOption,
} from "./LinkSettings";

type PanelKind = Pick<ChartSpec, "chartType" | "subType" | "dataset"> & {
  id: string;
  number: number;
  /** 그린 차트가 있는지 */
  drawn: boolean;
};

/** 칸 하나의 차트 종류·데이터셋 (그린 차트가 있으면 그린 설정, 없으면 고치는 설정). 견주기 쉬운 한 줄 글자로 */
function kindKey(store: WorkspaceStore) {
  const { current, draft } = store.getState();
  const spec = current?.spec ?? draft;
  return [
    spec.chartType,
    spec.subType ?? "",
    spec.dataset,
    current ? 1 : 0,
  ].join("\u0000");
}

/**
 * 모든 칸의 차트 종류·데이터셋. popover가 열린 동안만 쓰므로 칸 store를 모두 구독한다.
 * 바뀐 것이 없으면 같은 글자라 다시 그리지 않는다.
 */
function usePanelKinds(): PanelKind[] {
  const ids = useBoard(useShallow((s: BoardState) => s.panelIds));
  const panels = useBoard((s) => s.panels);
  const subscribe = useCallback(
    (notify: () => void) => {
      const stops = ids.map((id) => panels[id].subscribe(notify));
      return () => {
        for (const stop of stops) stop();
      };
    },
    [ids, panels],
  );
  const key = useSyncExternalStore(subscribe, () =>
    ids.map((id) => `${id}\u0001${kindKey(panels[id])}`).join("\n"),
  );
  return key.split("\n").map((line, i) => {
    const [id, rest] = line.split("\u0001");
    const [chartType, subType, dataset, drawn] = rest.split("\u0000");
    return {
      id,
      number: i + 1,
      chartType: chartType as ChartSpec["chartType"],
      subType: (subType || null) as ChartSpec["subType"],
      dataset,
      drawn: drawn === "1",
    };
  });
}

const columnOptions = (columns: readonly ColumnInfo[] | undefined) =>
  (columns ?? []).map((c) => ({ value: c.name, label: c.label }));

/** 걸린 범위 글자: 거르기 1,204행 / 강조 1,204행 */
export function useLinkRangeText() {
  const { t } = useLingui();
  return ({ rows, mode }: ItemLink) =>
    mode === "filter"
      ? t({
          message: plural(rows, { other: "거르기 #행" }),
          comment: "칸 연결로 걸린 범위: 방식(거르기)과 범위 안 행 수",
        })
      : t({
          message: plural(rows, { other: "강조 #행" }),
          comment: "칸 연결로 걸린 범위: 방식(강조)과 범위 안 행 수",
        });
}

/** 연결이 걸리지 않는 까닭. 따를 칸의 draw 실패(sourceFailed)는 job 상태에서 본다. */
export type LinkIssueShown = LinkIssue | "sourceFailed";

/** 연결이 걸리지 않는 까닭 */
export function useIssueText() {
  const { t } = useLingui();
  return (issue: LinkIssueShown) => {
    switch (issue) {
      case "sourceNotDrawn":
        return t`따를 칸을 그리면 범위가 걸립니다.`;
      case "sourceFailed":
        return t`따를 칸을 그리지 못해 범위가 풀렸습니다. 따를 칸을 다시 그리면 그 선택으로 걸립니다.`;
      case "sourceCannotFollow":
        return t`따를 칸의 차트는 선택을 행으로 바꿀 수 없어 범위가 걸리지 않습니다.`;
      case "needsColumns":
        return t`두 칸의 데이터가 달라 연결 컬럼을 골라야 범위가 걸립니다.`;
    }
  };
}

/** popover 안: 이 칸의 연결 설정. 열린 동안만 그린다. */
function LinkPopoverBody({ panelId }: { panelId: string }) {
  const { t } = useLingui();
  useLocale();
  const board = useBoardStore();
  const link = useBoard((s) => s.links[panelId]);
  const error = useBoard((s) => s.linkErrors[panelId]);
  const target = useBoard((s) => s.panels[panelId]);
  const draft = useStore(
    target,
    useShallow((s) => ({
      dataset: s.draft.dataset,
      chartType: s.draft.chartType,
      subType: s.draft.subType,
    })),
  );
  const kinds = usePanelKinds();
  const names = useDatasetNames();
  const range = useItemLink(target);
  const rangeText = useLinkRangeText();
  const issueText = useIssueText();
  const sourceFailed = useFollowFailed(panelId);
  const self = kinds.find((k) => k.id === panelId);
  const source = link && kinds.find((k) => k.id === link.follow);
  const sourceColumns = useDatasetSchema(source?.dataset ?? "").data?.columns;
  const targetColumns = useDatasetSchema(draft.dataset).data?.columns;

  const sources: SourceOption[] = kinds
    .filter((k) => k.id !== panelId)
    .map((k) => ({
      id: k.id,
      number: k.number,
      label: `${chartKindLabel(k)} · ${names(k.dataset)}`,
      disabledReason: canFollow(k)
        ? undefined
        : t`이 차트의 선택은 행으로 바꿀 수 없어 따를 수 없습니다.`,
    }));

  const differ = source !== undefined && source.dataset !== draft.dataset;
  const issue: LinkIssueShown | undefined = !source
    ? undefined
    : !source.drawn
      ? "sourceNotDrawn"
      : sourceFailed
        ? "sourceFailed"
        : !canFollow(source)
          ? "sourceCannotFollow"
          : differ && !link?.on
            ? "needsColumns"
            : undefined;
  const summary = range && rangeText(range);
  const status = issue
    ? issueText(issue)
    : summary
      ? t`지금 걸린 범위: ${summary}`
      : link && t`따를 칸에서 영역을 선택하면 범위가 걸립니다.`;

  const setLink = board.getState().setLink;
  const mode: LinkMode = link?.mode ?? defaultLinkMode(draft);
  const columns: ColumnsField | undefined = differ
    ? {
        source: columnOptions(sourceColumns),
        target: columnOptions(targetColumns),
        value: link?.on,
        onChange: (on) => link && setLink(panelId, { ...link, on }),
      }
    : undefined;

  return (
    <LinkSettings
      number={self?.number ?? 0}
      sources={sources}
      follow={link?.follow ?? null}
      onFollow={(follow) =>
        // 따를 칸을 바꾸면 방식은 두고 연결 컬럼은 새 쌍의 기본값으로 다시 정한다(연결 맞추기).
        setLink(panelId, { follow, mode })
      }
      mode={mode}
      highlightBlocked={
        canHighlight(draft)
          ? undefined
          : t`강조는 scatter·line(분포 제외) 차트에서만 쓸 수 있습니다.`
      }
      onMode={(next) => link && setLink(panelId, { ...link, mode: next })}
      columns={columns}
      status={status || undefined}
      error={error}
      onUnlink={() => setLink(panelId, null)}
    />
  );
}

/**
 * 칸 연결 popover. 칸 이름표의 연결 버튼과 왼쪽 패널의 `따를 칸`이 같은 내용을 연다.
 * 트리거 모양은 쓰는 곳이 children과 className으로 정한다.
 */
export function LinkPopover({
  panelId,
  className,
  label,
  title,
  onHover,
  children,
}: {
  panelId: string;
  className: string;
  /** 트리거의 접근성 이름 */
  label: string;
  title?: string;
  /** 트리거에 커서·포커스가 들어오고(true) 나갈 때(false). 상대 칸 테두리 강조에 쓴다. */
  onHover?: (hover: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={className}
        aria-label={label}
        title={title}
        onPointerEnter={() => onHover?.(true)}
        onPointerLeave={() => onHover?.(false)}
        onFocus={() => onHover?.(true)}
        onBlur={() => onHover?.(false)}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-popover outline-0"
          align="start"
          sideOffset={4}
          collisionPadding={8}
        >
          <Popover.Popup className="max-h-(--available-height) overflow-y-auto rounded-lg border border-line bg-elevated p-3 shadow-xl outline-0">
            <LinkPopoverBody panelId={panelId} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
