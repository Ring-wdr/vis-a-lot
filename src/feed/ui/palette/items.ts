// 팔레트 항목: 화면(이동)과 명령. 게시물은 /search 결과로 따로 붙인다.
// 화면에 기대지 않는 순수 함수라 테스트에서 바로 부른다.

import type { Group } from "../../api/types";
import { FEED, groupHref } from "../../lib/routes";
import { matchScore } from "./match";
import type { RecentEntry } from "./recent";

export type PaletteSection =
  | "recent"
  | "posts"
  | "screens"
  | "commands"
  | "users";

export type ScreenIcon =
  | "home"
  | "my"
  | "inbox"
  | "list"
  | "board"
  | "activity"
  | "status"
  | "settings"
  | "admin"
  | "outbox"
  | "seed"
  | "clock"
  | "bell";

export type CommandId = "new" | "new-full" | "switch-user" | "present";

export type PaletteItem =
  | {
      kind: "screen";
      id: string;
      label: string;
      hint?: string;
      keywords: string[];
      icon: ScreenIcon;
      href: string;
    }
  | {
      kind: "command";
      id: string;
      label: string;
      hint?: string;
      keywords: string[];
      command: CommandId;
    }
  | {
      kind: "post";
      id: string;
      label: string;
      hint?: string;
      postKey: string;
      snippet?: string | null;
    }
  | {
      kind: "user";
      id: string;
      label: string;
      hint?: string;
      userId: string;
      current: boolean;
    };

export function screenItems({
  groups,
  isAdmin,
}: {
  groups: Group[];
  isAdmin: boolean;
}): PaletteItem[] {
  const screen = (
    id: string,
    label: string,
    href: string,
    icon: ScreenIcon,
    keywords: string[] = [],
    hint?: string,
  ): PaletteItem => ({
    kind: "screen",
    id: `screen:${id}`,
    label,
    href,
    icon,
    keywords,
    hint,
  });
  const items: PaletteItem[] = [
    screen("home", "홈", FEED.home, "home", ["피드", "home"]),
    screen("my", "내 작업", FEED.my, "my", ["담당", "승인 대기", "my"]),
    screen("inbox", "알림함", FEED.inbox, "inbox", ["알림", "inbox"]),
    screen("notifications", "알림 설정", FEED.settingsNotifications, "bell", [
      "설정",
    ]),
  ];
  for (const g of groups) {
    const k = g.keyPrefix;
    const kw = [k, g.name];
    const hint = `${g.name} · ${k}`;
    items.push(
      screen(
        `list:${k}`,
        `${g.name} 리스트`,
        groupHref(FEED.list, k),
        "list",
        [...kw, "목록", "list"],
        hint,
      ),
      screen(
        `board:${k}`,
        `${g.name} 보드`,
        groupHref(FEED.board, k),
        "board",
        [...kw, "칸반", "board"],
        hint,
      ),
      screen(
        `activity:${k}`,
        `${g.name} 활동 보고`,
        groupHref(FEED.reportActivity, k),
        "activity",
        [...kw, "보고서", "report"],
        hint,
      ),
      screen(
        `status:${k}`,
        `${g.name} 현황 보고`,
        groupHref(FEED.reportStatus, k),
        "status",
        [...kw, "보고서", "report"],
        hint,
      ),
    );
    if (g.myRole === "admin")
      items.push(
        screen(
          `settings:${k}`,
          `${g.name} 그룹 설정`,
          groupHref(FEED.settingsGroup, k),
          "settings",
          [...kw, "멤버", "게시물 유형", "상태 이름"],
          hint,
        ),
      );
  }
  if (isAdmin)
    items.push(
      screen("admin", "관리 콘솔", FEED.admin, "admin", [
        "사용자",
        "관리자",
        "admin",
      ]),
    );
  items.push(
    screen(
      "outbox",
      "발송 로그",
      FEED.devOutbox,
      "outbox",
      ["슬랙", "이메일", "dev"],
      "개발",
    ),
    screen(
      "seed",
      "시드",
      FEED.devSeed,
      "seed",
      ["리셋", "데이터", "dev"],
      "개발",
    ),
    screen(
      "clock",
      "시계",
      FEED.devClock,
      "clock",
      ["오늘", "시간", "dev"],
      "개발",
    ),
  );
  return items;
}

export function commandItems({
  groupKey,
  reportPage,
  presenting,
}: {
  /** 지금 보고 있는 그룹 (?g=) */
  groupKey: string | null;
  /** 보고 화면이면 발표 모드 명령을 넣는다 */
  reportPage: boolean;
  presenting: boolean;
}): PaletteItem[] {
  const items: PaletteItem[] = [
    {
      kind: "command",
      id: "cmd:new",
      command: "new",
      label: "새 게시물",
      hint: groupKey ? `빠른 생성 · ${groupKey}` : "빠른 생성",
      keywords: ["만들기", "이슈", "create", "c"],
    },
    {
      kind: "command",
      id: "cmd:new-full",
      command: "new-full",
      label: "전체 폼으로 새 게시물",
      keywords: ["만들기", "새 게시물", "create"],
    },
    {
      kind: "command",
      id: "cmd:switch-user",
      command: "switch-user",
      label: "사용자 전환",
      hint: "사용자 목록",
      keywords: ["로그인", "user"],
    },
  ];
  if (reportPage)
    items.push({
      kind: "command",
      id: "cmd:present",
      command: "present",
      label: presenting ? "발표 모드 끄기" : "발표 모드 켜기",
      keywords: ["발표", "present"],
    });
  return items;
}

export type PaletteGroup = { section: PaletteSection; items: PaletteItem[] };

const searchable = (item: PaletteItem) =>
  item.kind === "screen" || item.kind === "command" ? item.keywords : [];

/**
 * 검색어로 거르고 정렬한다. 검색어가 없으면 최근 고른 것을 "최근"으로 맨 위에 둔다.
 * 검색어가 있으면 같은 점수끼리는 최근 고른 것이 앞이다.
 */
export function rankItems(
  q: string,
  items: PaletteItem[],
  recent: RecentEntry[],
): { recent: PaletteItem[]; rest: PaletteItem[] } {
  const order = new Map(recent.map((e, i) => [e.id, i]));
  if (!q.trim()) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const recentItems = recent
      .flatMap((e): PaletteItem[] => {
        const item = byId.get(e.id);
        if (item) return [item];
        // 게시물은 목록에 없으니 남겨 둔 이름으로 다시 만든다
        if (e.id.startsWith("post:") && e.label)
          return [
            {
              kind: "post",
              id: e.id,
              postKey: e.id.slice("post:".length),
              label: e.label,
            },
          ];
        return [];
      })
      .slice(0, 5);
    const shown = new Set(recentItems.map((i) => i.id));
    return { recent: recentItems, rest: items.filter((i) => !shown.has(i.id)) };
  }
  const scored = items.flatMap((item, index) => {
    const score = matchScore(q, item.label, searchable(item));
    return score === null ? [] : [{ item, score, index }];
  });
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      (order.get(a.item.id) ?? 99) - (order.get(b.item.id) ?? 99) ||
      a.index - b.index,
  );
  return { recent: [], rest: scored.map((s) => s.item) };
}

/** 이슈 키 일부처럼 보이나: fd-12, FD-, 12, 그룹 접두사(FD) */
export function looksLikeKey(q: string, prefixes: string[]) {
  const t = q.trim();
  return (
    /^\d+$/.test(t) ||
    /^[a-z][a-z0-9]{1,5}-\d*$/i.test(t) ||
    prefixes.some((p) => p.toLowerCase() === t.toLowerCase())
  );
}
