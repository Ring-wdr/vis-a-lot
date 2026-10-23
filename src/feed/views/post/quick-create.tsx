"use client";

// 빠른 생성 모달 (C 키, 팔레트): 제목 + 그룹, 나머지는 기본값. 만든 뒤 옆 패널로 연다. (구현: 상세 작업)

export type QuickCreateOptions = {
  /** 기본 그룹 (키 접두사 또는 id). 지금 보고 있는 그룹 */
  groupId?: string;
  /** 만든 게시물을 열 때 (보통 useOpenPeek) */
  onCreated?: (key: string) => void;
};

export function openQuickCreate(_options: QuickCreateOptions = {}) {}
