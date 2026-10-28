"use client";

// 체크리스트: 체크, 더하기, 빼기, 위·아래로 옮기기. 체크 비율이 진행률이 된다.

import { ph } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { detail, field } from "@/entities/post/ui/styles";
import { postsApi } from "@/shared/api/feed/posts";
import { cn } from "@/shared/lib/tw";
import { button, itemButton } from "@/shared/ui/button";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";
import "../config/messages";

const d = detail();

export function PostChecklist({ post }: { post: PostDetail }) {
  const { t } = useLingui();
  const { run, pending } = usePostAction();
  const [text, setText] = useState("");
  const items = [...post.checklist].sort((a, b) => a.sort - b.sort);
  const editable = post.permissions.edit;
  const done = items.filter((i) => i.done).length;

  const move = (index: number, delta: -1 | 1) => {
    const ids = items.map((i) => i.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    void run("reorder", t`순서를 바꾸지 못했습니다`, () =>
      postsApi.reorderChecklist(post.id, ids),
    );
  };

  if (!editable && items.length === 0) return null;

  return (
    <section className={d.section()} aria-labelledby="post-checklist-title">
      <div className={d.sectionHead()}>
        <h2 id="post-checklist-title" className={d.sectionTitle()}>
          <Trans>체크리스트</Trans>
          {items.length > 0 && (
            <span className="ml-1.5 font-normal text-fg-muted tabular-nums">
              {done}/{items.length}
            </span>
          )}
        </h2>
      </div>
      {items.length > 0 && (
        <ul className={d.list()} aria-busy={!!pending}>
          {items.map((item, i) => (
            <li
              key={item.id}
              className="group/item flex min-h-7.5 items-center gap-2 rounded-md px-1.5 hover:bg-panel"
            >
              <input
                type="checkbox"
                className="size-3.5 flex-none accent-accent"
                checked={item.done}
                disabled={!editable || !!pending}
                aria-label={item.text}
                onChange={(e) => {
                  const next = e.currentTarget.checked;
                  void run("check", t`체크하지 못했습니다`, () =>
                    postsApi.updateChecklistItem(post.id, item.id, {
                      done: next,
                    }),
                  );
                }}
              />
              <span
                className={cn(
                  "min-w-0 flex-1 wrap-break-word",
                  item.done && "text-fg-muted line-through",
                )}
              >
                {item.text}
              </span>
              {editable && (
                <span className="flex flex-none gap-0.5">
                  <button
                    type="button"
                    className={itemButton()}
                    aria-label={t`${ph({ item: item.text })} 위로`}
                    disabled={i === 0 || !!pending}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={itemButton()}
                    aria-label={t`${ph({ item: item.text })} 아래로`}
                    disabled={i === items.length - 1 || !!pending}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={itemButton()}
                    aria-label={t`${ph({ item: item.text })} 빼기`}
                    disabled={!!pending}
                    onClick={() =>
                      run("remove", t`항목을 빼지 못했습니다`, () =>
                        postsApi.removeChecklistItem(post.id, item.id),
                      )
                    }
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = text.trim();
            if (!value) return;
            if (
              await run("add", t`항목을 더하지 못했습니다`, () =>
                postsApi.addChecklistItem(post.id, value),
              )
            )
              setText("");
          }}
        >
          <input
            className={field()}
            value={text}
            maxLength={200}
            placeholder={t`항목 더하기`}
            aria-label={t`체크리스트 항목 더하기`}
            onChange={(e) => setText(e.currentTarget.value)}
          />
          <button
            type="submit"
            className={button({ size: "sm", class: "flex-none" })}
            disabled={!text.trim() || !!pending}
          >
            <Plus size={13} aria-hidden="true" />
            <Trans>더하기</Trans>
          </button>
        </form>
      )}
    </section>
  );
}
