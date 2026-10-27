"use client";

import { useState } from "react";

/**
 * 밖에서 받은 값을 화면에서 고칠 수 있는 사본으로 들고 있는다. 밖의 값이 바뀌면 사본도 그 값으로 돌아간다.
 * 바뀌었는지는 key로 본다. 배열처럼 렌더마다 새로 만들어지는 값은 내용을 담은 key(`join(",")`)를 넘긴다.
 * effect에서 setState로 맞추면 한 번 그린 뒤 다시 그리므로, 렌더 중에 이전 key와 비교해 바로 맞춘다.
 */
export function useDraftState<T>(source: T, key: unknown = source) {
  const [draft, setDraft] = useState(source);
  const [prevKey, setPrevKey] = useState(key);
  if (!Object.is(key, prevKey)) {
    setPrevKey(key);
    setDraft(source);
  }
  return [draft, setDraft] as const;
}
