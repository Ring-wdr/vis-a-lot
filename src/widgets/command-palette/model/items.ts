// 팔레트 항목: 화면(이동)과 명령. 게시물은 /search 결과로 따로 붙인다.
// 화면에 기대지 않는 순수 함수라 테스트에서 바로 부른다.

import { t } from "@lingui/core/macro";
import type { Group } from "@/shared/api/feed/types";
import { FEED, groupHref } from "@/shared/config/feed-routes";
import { matchScore } from "@/widgets/command-palette/lib/match";
import "../config/messages";
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

/**
 * 검색 키워드. 언어마다 한 메시지에 쉼표로 나눠 적는다 (낱말 수는 언어마다 달라도 된다).
 * 원문이 같은 다른 문구와 섞이지 않게 모두 이 context를 붙인다.
 */
const keywords = (words: string) =>
  words
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

/** 지금 화면 언어의 이름·키워드로 만든다. 그리는 컴포넌트는 useLocale로 언어 변경을 구독한다. */
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
    screen(
      "home",
      t`홈`,
      FEED.home,
      "home",
      keywords(t({ message: "피드, home", context: "palette keywords" })),
    ),
    screen(
      "my",
      t`내 작업`,
      FEED.my,
      "my",
      keywords(
        t({ message: "담당, 승인 대기, my", context: "palette keywords" }),
      ),
    ),
    screen(
      "inbox",
      t`알림함`,
      FEED.inbox,
      "inbox",
      keywords(t({ message: "알림, inbox", context: "palette keywords" })),
    ),
    screen(
      "notifications",
      t`알림 설정`,
      FEED.settingsNotifications,
      "bell",
      keywords(t({ message: "설정", context: "palette keywords" })),
    ),
  ];
  for (const g of groups) {
    const k = g.keyPrefix;
    const group = g.name;
    const kw = [k, group];
    const hint = `${group} · ${k}`;
    items.push(
      screen(
        `list:${k}`,
        t({ message: `${group} 리스트`, comment: "group: 그룹 이름" }),
        groupHref(FEED.list, k),
        "list",
        [
          ...kw,
          ...keywords(
            t({ message: "목록, list", context: "palette keywords" }),
          ),
        ],
        hint,
      ),
      screen(
        `board:${k}`,
        t({ message: `${group} 보드`, comment: "group: 그룹 이름" }),
        groupHref(FEED.board, k),
        "board",
        [
          ...kw,
          ...keywords(
            t({ message: "칸반, board", context: "palette keywords" }),
          ),
        ],
        hint,
      ),
      screen(
        `activity:${k}`,
        t({ message: `${group} 활동 보고`, comment: "group: 그룹 이름" }),
        groupHref(FEED.reportActivity, k),
        "activity",
        [
          ...kw,
          ...keywords(
            t({ message: "보고서, report", context: "palette keywords" }),
          ),
        ],
        hint,
      ),
      screen(
        `status:${k}`,
        t({ message: `${group} 현황 보고`, comment: "group: 그룹 이름" }),
        groupHref(FEED.reportStatus, k),
        "status",
        [
          ...kw,
          ...keywords(
            t({ message: "보고서, report", context: "palette keywords" }),
          ),
        ],
        hint,
      ),
    );
    if (g.myRole === "admin")
      items.push(
        screen(
          `settings:${k}`,
          t({ message: `${group} 그룹 설정`, comment: "group: 그룹 이름" }),
          groupHref(FEED.settingsGroup, k),
          "settings",
          [
            ...kw,
            ...keywords(
              t({
                message: "멤버, 게시물 유형, 상태 이름",
                context: "palette keywords",
              }),
            ),
          ],
          hint,
        ),
      );
  }
  if (isAdmin)
    items.push(
      screen(
        "admin",
        t`관리 콘솔`,
        FEED.admin,
        "admin",
        keywords(
          t({ message: "사용자, 관리자, admin", context: "palette keywords" }),
        ),
      ),
    );
  const dev = t({ message: "개발", context: "palette hint: dev-only screen" });
  items.push(
    screen(
      "outbox",
      t`발송 로그`,
      FEED.devOutbox,
      "outbox",
      keywords(
        t({ message: "슬랙, 이메일, dev", context: "palette keywords" }),
      ),
      dev,
    ),
    screen(
      "seed",
      t`시드`,
      FEED.devSeed,
      "seed",
      keywords(
        t({ message: "리셋, 데이터, dev", context: "palette keywords" }),
      ),
      dev,
    ),
    screen(
      "clock",
      t`시계`,
      FEED.devClock,
      "clock",
      keywords(t({ message: "오늘, 시간, dev", context: "palette keywords" })),
      dev,
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
      label: t`새 게시물`,
      hint: groupKey
        ? t({
            message: `빠른 생성 · ${groupKey}`,
            comment: "groupKey: 그룹 키 접두사 (FD)",
          })
        : t`빠른 생성`,
      keywords: keywords(
        t({ message: "만들기, 이슈, create, c", context: "palette keywords" }),
      ),
    },
    {
      kind: "command",
      id: "cmd:new-full",
      command: "new-full",
      label: t`전체 폼으로 새 게시물`,
      keywords: keywords(
        t({
          message: "만들기, 새 게시물, create",
          context: "palette keywords",
        }),
      ),
    },
    {
      kind: "command",
      id: "cmd:switch-user",
      command: "switch-user",
      label: t`사용자 전환`,
      hint: t`사용자 목록`,
      keywords: keywords(
        t({ message: "로그인, user", context: "palette keywords" }),
      ),
    },
  ];
  if (reportPage)
    items.push({
      kind: "command",
      id: "cmd:present",
      command: "present",
      label: presenting ? t`발표 모드 끄기` : t`발표 모드 켜기`,
      keywords: keywords(
        t({ message: "발표, present", context: "palette keywords" }),
      ),
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
