"use client";

// 커맨드 팔레트 (Cmd/Ctrl+K, 상단 바의 "검색·명령"): 게시물 찾기, 화면 이동, 명령, 사용자 전환.
// ↑/↓로 고르고 Enter로 실행, Esc로 닫는다(사용자 전환 목록에서는 처음으로 돌아간다).

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  Check,
  Columns3,
  Command,
  Database,
  FileBarChart,
  FileText,
  Home,
  Inbox,
  List,
  Mail,
  PieChart,
  Search,
  Settings,
  Shield,
  User,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { openQuickCreate } from "@/features/create-post/ui/quick-create";
import { useSwitchUser } from "@/features/switch-user/ui/UserSwitcher";
import { useGroups, useMe, useUsers } from "@/shared/api/feed/queries";
import { useSearchPosts } from "@/shared/api/feed/search";
import { FEED } from "@/shared/config/feed-routes";
import { useOpenPeek } from "@/shared/lib/peek";
import { Dialog } from "@/shared/ui/Dialog";
import { Spinner } from "@/shared/ui/Loading";
import { matchScore } from "@/widgets/command-palette/lib/match";
import {
  commandItems,
  looksLikeKey,
  type PaletteItem,
  type PaletteSection,
  rankItems,
  type ScreenIcon,
  screenItems,
} from "@/widgets/command-palette/model/items";
import {
  loadRecent,
  type RecentEntry,
  saveRecent,
} from "@/widgets/command-palette/model/recent";

const SECTION_LABELS: Record<PaletteSection, string> = {
  recent: "최근",
  posts: "게시물",
  screens: "화면",
  commands: "명령",
  users: "사용자",
};

const SCREEN_ICONS: Record<ScreenIcon, LucideIcon> = {
  home: Home,
  my: UserRound,
  inbox: Inbox,
  bell: Bell,
  list: List,
  board: Columns3,
  activity: FileBarChart,
  status: PieChart,
  settings: Settings,
  admin: Shield,
  outbox: Mail,
  seed: Database,
  clock: CalendarClock,
};

function itemIcon(item: PaletteItem): LucideIcon {
  switch (item.kind) {
    case "screen":
      return SCREEN_ICONS[item.icon];
    case "post":
      return FileText;
    case "user":
      return User;
    case "command":
      return Command;
  }
}

/** 검색어를 잠깐 기다렸다가 넘긴다 (입력할 때마다 /search를 부르지 않게) */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type Section = { section: PaletteSection; items: PaletteItem[] };

const POST_LIMIT = 8;
const SCREEN_LIMIT_WITH_QUERY = 12;

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const baseId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const openPeek = useOpenPeek();
  const switchUser = useSwitchUser();
  const groups = useGroups();
  const me = useMe();
  const users = useUsers();
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"root" | "users">("root");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<RecentEntry[]>(loadRecent);
  const term = useDebounced(q.trim(), 200);
  const posts = useSearchPosts(mode === "root" ? term : "");

  const groupKey = search.get("g");
  const presenting = search.get("present") === "1";
  const reportPage = pathname.startsWith("/feed/report/");

  const base = useMemo(
    () => ({
      screens: screenItems({
        groups: groups.data ?? [],
        isAdmin: !!me.data?.isAdmin,
      }),
      commands: commandItems({ groupKey, reportPage, presenting }),
    }),
    [groups.data, me.data?.isAdmin, groupKey, reportPage, presenting],
  );

  const sections = useMemo<Section[]>(() => {
    if (mode === "users") {
      const list = (users.data ?? [])
        .filter((u) => u.active)
        .flatMap((u) => {
          const score = matchScore(q, u.name, u.email ? [u.email] : []);
          if (score === null) return [];
          const item: PaletteItem = {
            kind: "user",
            id: `user:${u.id}`,
            userId: u.id,
            label: u.name,
            hint: u.isAdmin ? "시스템 관리자" : (u.email ?? undefined),
            current: u.id === me.data?.id,
          };
          return [{ item, score }];
        })
        .sort((a, b) => a.score - b.score)
        .map((x) => x.item);
      return [{ section: "users", items: list }];
    }
    const all = [...base.screens, ...base.commands];
    const ranked = rankItems(q, all, recent);
    const out: Section[] = [];
    if (ranked.recent.length)
      out.push({ section: "recent", items: ranked.recent });
    const postItems: PaletteItem[] = q.trim()
      ? (posts.data ?? []).slice(0, POST_LIMIT).map((h) => ({
          kind: "post",
          id: `post:${h.key}`,
          postKey: h.key,
          label: h.title,
          snippet: h.snippet,
        }))
      : [];
    const screens = ranked.rest.filter((i) => i.kind === "screen");
    const commands = ranked.rest.filter((i) => i.kind === "command");
    const parts: Section[] = [
      {
        section: "screens",
        items: q.trim() ? screens.slice(0, SCREEN_LIMIT_WITH_QUERY) : screens,
      },
      { section: "commands", items: commands },
    ];
    // 이슈 키처럼 보이면(FD-12, 12) 게시물을 맨 앞에, 아니면 화면·명령 다음에 둔다
    const posts_: Section = { section: "posts", items: postItems };
    if (
      looksLikeKey(
        q,
        (groups.data ?? []).map((g) => g.keyPrefix),
      )
    )
      parts.unshift(posts_);
    else parts.push(posts_);
    out.push(...parts.filter((p) => p.items.length > 0));
    return out;
  }, [mode, users.data, me.data?.id, q, base, recent, posts.data, groups.data]);

  const flat = sections.flatMap((s) => s.items);
  const current = Math.min(active, Math.max(0, flat.length - 1));
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // 고른 항목을 목록 안에 보이게
  useEffect(() => {
    document
      .getElementById(`${baseId}-opt-${current}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [baseId, current]);

  const remember = (entry: RecentEntry) => setRecent(saveRecent(entry));

  const run = (item: PaletteItem) => {
    switch (item.kind) {
      case "screen":
        remember({ id: item.id });
        onClose();
        router.push(item.href);
        return;
      case "post":
        remember({ id: item.id, label: item.label });
        onClose();
        openPeek(item.postKey);
        return;
      case "user":
        onClose();
        switchUser(item.userId);
        return;
      case "command":
        remember({ id: item.id });
        switch (item.command) {
          case "new":
            onClose();
            openQuickCreate({
              groupId: groupKey ?? undefined,
              onCreated: openPeek,
            });
            return;
          case "new-full":
            onClose();
            router.push(FEED.new);
            return;
          case "switch-user":
            setMode("users");
            setQ("");
            setActive(0);
            inputRef.current?.focus();
            return;
          case "present": {
            const next = new URLSearchParams(search);
            if (presenting) next.delete("present");
            else next.set("present", "1");
            onClose();
            const query = next.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, {
              scroll: false,
            });
            return;
          }
        }
    }
  };

  const back = () => {
    setMode("root");
    setQ("");
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 한글 조합 중의 Enter·화살표는 입력기가 쓴다
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (flat.length) setActive((current + 1) % flat.length);
        return;
      case "ArrowUp":
        e.preventDefault();
        if (flat.length) setActive((current - 1 + flat.length) % flat.length);
        return;
      case "Home":
        if (!q) {
          e.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (!q) {
          e.preventDefault();
          setActive(Math.max(0, flat.length - 1));
        }
        return;
      case "Enter": {
        e.preventDefault();
        const item = flat[current];
        if (item) run(item);
        return;
      }
      case "Escape":
        // 사용자 목록에서는 닫지 않고 처음으로 (dialog의 cancel도 막는다)
        if (mode === "users") {
          e.preventDefault();
          e.stopPropagation();
          back();
        }
        return;
      case "Backspace":
        if (mode === "users" && !q) {
          e.preventDefault();
          back();
        }
        return;
    }
  };

  const searching =
    mode === "root" && !!q.trim() && (posts.isFetching || term !== q.trim());
  let index = -1;

  return (
    <Dialog
      isOpen
      onClose={onClose}
      labelledBy={`${baseId}-title`}
      className="w-[min(40rem,calc(100vw-2rem))] max-w-none bg-elevated p-0 text-ui text-fg"
    >
      <h2 id={`${baseId}-title`} className="sr-only">
        커맨드 팔레트
      </h2>
      <div className="flex min-w-0 items-center gap-2 border-b border-line px-3">
        {mode === "users" ? (
          <button
            type="button"
            className="inline-flex h-6 flex-none cursor-pointer items-center gap-1 rounded-sm bg-accent-soft px-1.5 text-2xs font-semibold text-accent"
            onClick={back}
            aria-label="사용자 전환에서 돌아가기"
          >
            <ArrowLeft size={12} aria-hidden="true" />
            사용자 전환
          </button>
        ) : (
          <Search
            size={16}
            className="flex-none text-fg-muted"
            aria-hidden="true"
          />
        )}
        <input
          ref={inputRef}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-muted"
          value={q}
          placeholder={
            mode === "users"
              ? "사용자 이름"
              : "게시물(FD-12, 제목), 화면, 명령 찾기"
          }
          role="combobox"
          aria-expanded="true"
          aria-controls={`${baseId}-list`}
          aria-activedescendant={flat.length ? optionId(current) : undefined}
          aria-autocomplete="list"
          aria-label={mode === "users" ? "사용자 찾기" : "검색·명령"}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          onChange={(e) => {
            setQ(e.currentTarget.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        {searching && <Spinner size="sm" />}
      </div>
      <div
        id={`${baseId}-list`}
        role="listbox"
        aria-label="결과"
        className="max-h-[min(26rem,calc(100dvh-16rem))] overflow-y-auto p-1.5"
      >
        {flat.length === 0 && (
          <p className="px-2.5 py-6 text-center text-fg-muted">
            {searching ? "찾는 중" : "맞는 항목이 없습니다"}
          </p>
        )}
        {sections.map((s) => (
          // biome-ignore lint/a11y/useSemanticElements: listbox 안의 묶음은 ARIA group이라 fieldset을 쓰지 않는다
          <div
            key={s.section}
            role="group"
            aria-labelledby={`${baseId}-sec-${s.section}`}
            className="flex flex-col not-first:mt-1.5"
          >
            <p
              id={`${baseId}-sec-${s.section}`}
              className="px-2.5 pt-1.5 pb-1 text-2xs font-semibold text-fg-muted"
            >
              {SECTION_LABELS[s.section]}
            </p>
            {s.items.map((item) => {
              index += 1;
              const i = index;
              const Icon = itemIcon(item);
              return (
                <div
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === current}
                  tabIndex={-1}
                  className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 aria-selected:bg-accent-soft"
                  onMouseMove={() => i !== current && setActive(i)}
                  onClick={() => run(item)}
                  onKeyDown={() => {}}
                >
                  <Icon
                    size={14}
                    className="flex-none text-fg-muted"
                    aria-hidden="true"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-baseline gap-2">
                      {item.kind === "post" && (
                        <span className="flex-none font-mono text-2xs text-fg-muted">
                          {item.postKey}
                        </span>
                      )}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.kind === "post" && item.snippet && (
                      <span className="truncate text-2xs text-fg-muted">
                        {item.snippet}
                      </span>
                    )}
                  </span>
                  {item.kind === "user" && item.current && (
                    <Check
                      size={14}
                      className="flex-none text-accent"
                      aria-label="지금 사용자"
                    />
                  )}
                  {item.hint && (
                    <span className="hidden max-w-40 flex-none truncate text-2xs text-fg-muted sm:inline">
                      {item.hint}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="hidden items-center gap-3 border-t border-line px-3 py-1.5 text-2xs text-fg-muted sm:flex">
        <span>
          <kbd className="font-sans">↑↓</kbd> 고르기
        </span>
        <span>
          <kbd className="font-sans">Enter</kbd> 실행
        </span>
        <span>
          <kbd className="font-sans">Esc</kbd>{" "}
          {mode === "users" ? "돌아가기" : "닫기"}
        </span>
      </div>
    </Dialog>
  );
}
