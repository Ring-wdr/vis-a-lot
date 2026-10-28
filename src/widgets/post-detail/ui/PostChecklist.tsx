"use client";

// 체크리스트: 체크, 더하기, 빼기, 위·아래로 옮기기. 체크 비율이 진행률이 된다.

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { detail, field } from "@/entities/post/ui/styles";
import { postsApi } from "@/shared/api/feed/posts";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/tw";
import { button, itemButton } from "@/shared/ui/button";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const messages = defineMessages({
  ko: {
    reorderFailed: "순서를 바꾸지 못했습니다",
    title: "체크리스트",
    checkFailed: "체크하지 못했습니다",
    moveUp: (item: string) => `${item} 위로`,
    moveDown: (item: string) => `${item} 아래로`,
    remove: (item: string) => `${item} 빼기`,
    removeFailed: "항목을 빼지 못했습니다",
    addFailed: "항목을 더하지 못했습니다",
    placeholder: "항목 더하기",
    addLabel: "체크리스트 항목 더하기",
    add: "더하기",
  },
  en: {
    reorderFailed: "Couldn't reorder",
    title: "Checklist",
    checkFailed: "Couldn't update the item",
    moveUp: (item: string) => `Move ${item} up`,
    moveDown: (item: string) => `Move ${item} down`,
    remove: (item: string) => `Remove ${item}`,
    removeFailed: "Couldn't remove the item",
    addFailed: "Couldn't add the item",
    placeholder: "Add item",
    addLabel: "Add checklist item",
    add: "Add",
  },
});

const d = detail();

export function PostChecklist({ post }: { post: PostDetail }) {
  const msg = useT(messages);
  const { run, pending } = usePostAction();
  const [text, setText] = useState("");
  const items = [...post.checklist].sort((a, b) => a.sort - b.sort);
  const editable = post.permissions.edit;
  const done = items.filter((i) => i.done).length;

  const move = (index: number, delta: -1 | 1) => {
    const ids = items.map((i) => i.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    void run("reorder", msg.reorderFailed, () =>
      postsApi.reorderChecklist(post.id, ids),
    );
  };

  if (!editable && items.length === 0) return null;

  return (
    <section className={d.section()} aria-labelledby="post-checklist-title">
      <div className={d.sectionHead()}>
        <h2 id="post-checklist-title" className={d.sectionTitle()}>
          {msg.title}
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
                  void run("check", msg.checkFailed, () =>
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
                    aria-label={msg.moveUp(item.text)}
                    disabled={i === 0 || !!pending}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={itemButton()}
                    aria-label={msg.moveDown(item.text)}
                    disabled={i === items.length - 1 || !!pending}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={itemButton()}
                    aria-label={msg.remove(item.text)}
                    disabled={!!pending}
                    onClick={() =>
                      run("remove", msg.removeFailed, () =>
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
              await run("add", msg.addFailed, () =>
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
            placeholder={msg.placeholder}
            aria-label={msg.addLabel}
            onChange={(e) => setText(e.currentTarget.value)}
          />
          <button
            type="submit"
            className={button({ size: "sm", class: "flex-none" })}
            disabled={!text.trim() || !!pending}
          >
            <Plus size={13} aria-hidden="true" />
            {msg.add}
          </button>
        </form>
      )}
    </section>
  );
}
