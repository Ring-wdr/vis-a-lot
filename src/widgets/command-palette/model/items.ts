// 팔레트 항목: 화면(이동)과 명령. 게시물은 /search 결과로 따로 붙인다.
// 화면에 기대지 않는 순수 함수라 테스트에서 바로 부른다.

import type { Group } from "@/shared/api/feed/types";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { defineMessages, t } from "@/shared/lib/i18n";
import { matchScore } from "@/widgets/command-palette/lib/match";
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

const messages = defineMessages({
  ko: {
    home: "홈",
    homeKw: ["피드", "home"],
    my: "내 작업",
    myKw: ["담당", "승인 대기", "my"],
    inbox: "알림함",
    inboxKw: ["알림", "inbox"],
    notifications: "알림 설정",
    notificationsKw: ["설정"],
    list: (group: string) => `${group} 리스트`,
    listKw: ["목록", "list"],
    board: (group: string) => `${group} 보드`,
    boardKw: ["칸반", "board"],
    activity: (group: string) => `${group} 활동 보고`,
    status: (group: string) => `${group} 현황 보고`,
    reportKw: ["보고서", "report"],
    groupSettings: (group: string) => `${group} 그룹 설정`,
    groupSettingsKw: ["멤버", "게시물 유형", "상태 이름"],
    admin: "관리 콘솔",
    adminKw: ["사용자", "관리자", "admin"],
    dev: "개발",
    outbox: "발송 로그",
    outboxKw: ["슬랙", "이메일", "dev"],
    seed: "시드",
    seedKw: ["리셋", "데이터", "dev"],
    clock: "시계",
    clockKw: ["오늘", "시간", "dev"],
    newPost: "새 게시물",
    quickCreate: "빠른 생성",
    quickCreateIn: (group: string) => `빠른 생성 · ${group}`,
    newPostKw: ["만들기", "이슈", "create", "c"],
    newPostFull: "전체 폼으로 새 게시물",
    newPostFullKw: ["만들기", "새 게시물", "create"],
    switchUser: "사용자 전환",
    userList: "사용자 목록",
    switchUserKw: ["로그인", "user"],
    presentOff: "발표 모드 끄기",
    presentOn: "발표 모드 켜기",
    presentKw: ["발표", "present"],
  },
  en: {
    home: "Home",
    homeKw: ["feed", "home"],
    my: "My work",
    myKw: ["assigned", "pending approval", "my"],
    inbox: "Inbox",
    inboxKw: ["notifications", "inbox"],
    notifications: "Notification settings",
    notificationsKw: ["settings"],
    list: (group: string) => `${group} list`,
    listKw: ["list"],
    board: (group: string) => `${group} board`,
    boardKw: ["kanban", "board"],
    activity: (group: string) => `${group} activity report`,
    status: (group: string) => `${group} status report`,
    reportKw: ["report"],
    groupSettings: (group: string) => `${group} group settings`,
    groupSettingsKw: ["members", "post types", "status names"],
    admin: "Admin console",
    adminKw: ["users", "admins", "admin"],
    dev: "Dev",
    outbox: "Outbox log",
    outboxKw: ["slack", "email", "dev"],
    seed: "Seed",
    seedKw: ["reset", "data", "dev"],
    clock: "Clock",
    clockKw: ["today", "time", "dev"],
    newPost: "New post",
    quickCreate: "Quick create",
    quickCreateIn: (group: string) => `Quick create · ${group}`,
    newPostKw: ["create", "issue", "new", "c"],
    newPostFull: "New post with full form",
    newPostFullKw: ["create", "new post"],
    switchUser: "Switch user",
    userList: "User list",
    switchUserKw: ["login", "user"],
    presentOff: "Turn off presentation mode",
    presentOn: "Turn on presentation mode",
    presentKw: ["present", "presentation"],
  },
});

/** 지금 화면 언어의 이름·키워드로 만든다. 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다. */
export function screenItems({
  groups,
  isAdmin,
}: {
  groups: Group[];
  isAdmin: boolean;
}): PaletteItem[] {
  const text = t(messages);
  const screen = (
    id: string,
    label: string,
    href: string,
    icon: ScreenIcon,
    keywords: readonly string[] = [],
    hint?: string,
  ): PaletteItem => ({
    kind: "screen",
    id: `screen:${id}`,
    label,
    href,
    icon,
    keywords: [...keywords],
    hint,
  });
  const items: PaletteItem[] = [
    screen("home", text.home, FEED.home, "home", text.homeKw),
    screen("my", text.my, FEED.my, "my", text.myKw),
    screen("inbox", text.inbox, FEED.inbox, "inbox", text.inboxKw),
    screen(
      "notifications",
      text.notifications,
      FEED.settingsNotifications,
      "bell",
      text.notificationsKw,
    ),
  ];
  for (const g of groups) {
    const k = g.keyPrefix;
    const kw = [k, g.name];
    const hint = `${g.name} · ${k}`;
    items.push(
      screen(
        `list:${k}`,
        text.list(g.name),
        groupHref(FEED.list, k),
        "list",
        [...kw, ...text.listKw],
        hint,
      ),
      screen(
        `board:${k}`,
        text.board(g.name),
        groupHref(FEED.board, k),
        "board",
        [...kw, ...text.boardKw],
        hint,
      ),
      screen(
        `activity:${k}`,
        text.activity(g.name),
        groupHref(FEED.reportActivity, k),
        "activity",
        [...kw, ...text.reportKw],
        hint,
      ),
      screen(
        `status:${k}`,
        text.status(g.name),
        groupHref(FEED.reportStatus, k),
        "status",
        [...kw, ...text.reportKw],
        hint,
      ),
    );
    if (g.myRole === "admin")
      items.push(
        screen(
          `settings:${k}`,
          text.groupSettings(g.name),
          groupHref(FEED.settingsGroup, k),
          "settings",
          [...kw, ...text.groupSettingsKw],
          hint,
        ),
      );
  }
  if (isAdmin)
    items.push(screen("admin", text.admin, FEED.admin, "admin", text.adminKw));
  items.push(
    screen(
      "outbox",
      text.outbox,
      FEED.devOutbox,
      "outbox",
      text.outboxKw,
      text.dev,
    ),
    screen("seed", text.seed, FEED.devSeed, "seed", text.seedKw, text.dev),
    screen("clock", text.clock, FEED.devClock, "clock", text.clockKw, text.dev),
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
  const text = t(messages);
  const items: PaletteItem[] = [
    {
      kind: "command",
      id: "cmd:new",
      command: "new",
      label: text.newPost,
      hint: groupKey ? text.quickCreateIn(groupKey) : text.quickCreate,
      keywords: [...text.newPostKw],
    },
    {
      kind: "command",
      id: "cmd:new-full",
      command: "new-full",
      label: text.newPostFull,
      keywords: [...text.newPostFullKw],
    },
    {
      kind: "command",
      id: "cmd:switch-user",
      command: "switch-user",
      label: text.switchUser,
      hint: text.userList,
      keywords: [...text.switchUserKw],
    },
  ];
  if (reportPage)
    items.push({
      kind: "command",
      id: "cmd:present",
      command: "present",
      label: presenting ? text.presentOff : text.presentOn,
      keywords: [...text.presentKw],
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
  const term = q.trim();
  return (
    /^\d+$/.test(term) ||
    /^[a-z][a-z0-9]{1,5}-\d*$/i.test(term) ||
    prefixes.some((p) => p.toLowerCase() === term.toLowerCase())
  );
}
