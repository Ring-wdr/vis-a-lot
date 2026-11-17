"use client";

import { Popover } from "@base-ui/react/popover";
import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { intlLocale } from "@vis-a-lot/shared/lib/i18n";
import { segmented } from "@vis-a-lot/shared/ui/segmented";
import { Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { useWorkspace } from "@/entities/workspace/model/workspace-scope";
import { useJobProgress, useMatchedItems } from "@/shared/api/queries";
import type {
  ItemSearch as ItemSearchConds,
  ItemSearchMatch,
  JobStateResponse,
} from "@/shared/api/types";
import { itemButton, linkButton } from "@/shared/ui/button";
import "../config/messages";
import {
  type AddCondResult,
  addCond,
  MAX_SEARCH_CONDS,
  MAX_SEARCH_KEYWORD,
  removeCond,
  SEARCH_MATCHES,
} from "../model/search-conds";

const MATCH_NAMES: Record<ItemSearchMatch, MessageDescriptor> = {
  contains: msg({ message: "포함", context: "item search match" }),
  startsWith: msg({ message: "시작", context: "item search match" }),
  endsWith: msg({ message: "끝", context: "item search match" }),
  exact: msg({ message: "완전 일치", context: "item search match" }),
};

type Refusal = Extract<AddCondResult, { ok: false }>["reason"];

const seg = segmented();

/**
 * item 이름 검색 입력. 포커스가 들어오면 일치 방식과 걸어 둔 조건 목록 popover가 열린다.
 * 입력 중 글자는 여기에만 두고 Enter로만 조건이 된다. 조건은 props로 받고 바꾼 목록을 onChange로 알린다.
 */
export function ItemSearchField({
  search,
  matched,
  disabled = false,
  onChange,
}: {
  search: ItemSearchConds;
  /** 조건에 맞는 item 수. 모르면 null */
  matched: number | null;
  disabled?: boolean;
  onChange: (search: ItemSearchConds) => void;
}) {
  const { t, i18n } = useLingui();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [match, setMatch] = useState<ItemSearchMatch>("contains");
  const [open, setOpen] = useState(false);
  const [refusal, setRefusal] = useState<Refusal>();

  const refusalText: Record<Exclude<Refusal, "empty">, string> = {
    duplicate: t`이미 걸어 둔 조건입니다.`,
    limit: t`조건은 ${MAX_SEARCH_CONDS}개까지 걸 수 있습니다.`,
    tooLong: t`검색어는 ${MAX_SEARCH_KEYWORD}자까지 쓸 수 있습니다.`,
  };

  const add = () => {
    const result = addCond(search, text, match);
    if (!result.ok) {
      setRefusal(result.reason === "empty" ? undefined : result.reason);
      return;
    }
    setRefusal(undefined);
    setText("");
    onChange(result.search);
  };

  const matchedText =
    matched === null ? "…" : matched.toLocaleString(intlLocale());
  const shown = open && !disabled;

  return (
    <Popover.Root
      open={shown}
      onOpenChange={(next, details) => {
        // 입력을 누른 것도 popover 바깥이다. 입력에 포커스가 있는 동안은 열어 둔다.
        if (
          !next &&
          details.reason === "outside-press" &&
          details.event.target instanceof Node &&
          anchorRef.current?.contains(details.event.target)
        )
          return;
        setOpen(next);
      }}
    >
      <div
        ref={anchorRef}
        className="flex h-7.5 w-56 min-w-0 items-center gap-1.5 rounded-md border border-line bg-elevated px-2 text-ui has-focus-visible:border-accent-line has-disabled:opacity-50"
      >
        <Search
          size={14}
          className="flex-none text-fg-muted"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          className="min-w-0 flex-1 bg-transparent text-fg outline-0 placeholder:text-fg-muted disabled:cursor-not-allowed"
          placeholder={t`차트 이름 검색`}
          aria-label={t`차트 이름 검색`}
          maxLength={MAX_SEARCH_KEYWORD}
          disabled={disabled}
          value={text}
          onFocus={() => setOpen(true)}
          onBlur={(e) => {
            // 포커스가 popover 밖으로 옮겨 가면(Tab) 닫는다. 바깥 클릭은 popover가 닫는다.
            const next = e.relatedTarget;
            if (next && !popupRef.current?.contains(next)) setOpen(false);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setRefusal(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              setOpen(true);
              add();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {search.length > 0 && (
          <output
            className="flex-none text-xs whitespace-nowrap text-fg-secondary tabular-nums"
            aria-live="polite"
            title={t`조건에 맞는 차트 수`}
          >
            {t({
              message: `${matchedText}개`,
              comment: "matchedText: 검색 조건에 맞는 차트 수 (자릿수 구분)",
            })}
          </output>
        )}
      </div>
      <Popover.Portal>
        <Popover.Positioner
          className="z-popover outline-0"
          anchor={anchorRef}
          align="end"
          sideOffset={4}
        >
          <Popover.Popup
            ref={popupRef}
            initialFocus={false}
            finalFocus={false}
            aria-label={t`차트 이름 검색 조건`}
            className="flex w-72 flex-col gap-2.5 rounded-lg border border-line bg-elevated p-3 text-ui shadow-xl outline-0"
          >
            <fieldset className={seg.root()} aria-label={t`일치 방식`}>
              {SEARCH_MATCHES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={seg.item()}
                  aria-pressed={match === m}
                  // 방식을 바꿔도 입력에 포커스를 둔다 (이어서 Enter).
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setMatch(m);
                    setRefusal(undefined);
                  }}
                >
                  {i18n._(MATCH_NAMES[m])}
                </button>
              ))}
            </fieldset>
            {refusal && refusal !== "empty" && (
              <p role="status" className="text-xs text-danger">
                {refusalText[refusal]}
              </p>
            )}
            {search.length === 0 ? (
              <p className="text-xs text-fg-muted">
                <Trans>
                  이름을 입력하고 Enter를 누르면 조건을 겁니다. 조건이 여럿이면
                  하나라도 맞는 차트를 보여 줍니다.
                </Trans>
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-1">
                  {search.map(({ keyword, match: condMatch }, index) => (
                    <li
                      key={`${condMatch}:${keyword}`}
                      className="flex min-w-0 items-center gap-2 text-xs"
                    >
                      <span
                        className="min-w-0 flex-1 truncate text-fg"
                        title={keyword}
                      >
                        {keyword}
                      </span>
                      <span className="flex-none text-fg-muted">
                        {i18n._(MATCH_NAMES[condMatch])}
                      </span>
                      <button
                        type="button"
                        className={itemButton()}
                        aria-label={t({
                          message: `"${keyword}" 조건 지우기`,
                          comment:
                            "keyword: 검색 조건의 글자. 조건 하나를 지우는 버튼",
                        })}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => onChange(removeCond(search, index))}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={linkButton()}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange([]);
                    inputRef.current?.focus();
                  }}
                >
                  <Trans>모두 지우기</Trans>
                </button>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const totalItemsOf = (job: JobStateResponse) => job.totalItems;

/** 탭 도구 줄의 item 검색. 그린 차트가 없거나 item이 하나뿐이면 막는다. */
export function ItemSearch() {
  const jobId = useWorkspace((s) => s.current?.jobId);
  const search = useWorkspace((s) => s.search);
  const setSearch = useWorkspace((s) => s.setSearch);
  // 개수만 고른다. 진행률 응답이 와도 다시 그리지 않는다.
  const totalItems = useJobProgress(jobId, totalItemsOf).data ?? null;
  const matched = useMatchedItems(jobId, search);
  const disabled =
    jobId === undefined || (search.length === 0 && (totalItems ?? 0) <= 1);
  return (
    <ItemSearchField
      search={search}
      matched={matched}
      disabled={disabled}
      onChange={setSearch}
    />
  );
}
