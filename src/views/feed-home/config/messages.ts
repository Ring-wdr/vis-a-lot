import { defineIntlMessages } from "@/shared/lib/intl-messages";

/** next-intl 네임스페이스 FeedHome (application/intl-messages.ts에 등록) */
export const feedHomeMessages = defineIntlMessages({
  ko: {
    groups: "그룹",
    all: "전체",
    loadFailed: "게시물을 불러오지 못했습니다 ({reason})",
    retry: "다시 시도",
    empty: "게시물이 없습니다",
    newPost: "새 게시물 만들기",
    posts: "게시물",
    loading: "불러오는 중",
    more: "더 보기",
    home: "홈",
    groupsFailed: "그룹을 불러오지 못했습니다 ({reason})",
    unknownGroup: "모르는 그룹입니다",
    showAll: "전체 보기",
  },
  en: {
    groups: "Groups",
    all: "All",
    loadFailed: "Couldn't load posts ({reason})",
    retry: "Retry",
    empty: "No posts yet",
    newPost: "Create a post",
    posts: "Posts",
    loading: "Loading",
    more: "Load more",
    home: "Home",
    groupsFailed: "Couldn't load groups ({reason})",
    unknownGroup: "Unknown group",
    showAll: "Show all",
  },
});
