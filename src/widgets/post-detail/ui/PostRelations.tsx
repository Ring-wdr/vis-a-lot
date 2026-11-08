"use client";

// 관계: 상위 이슈(정하기·빼기), 하위 이슈, 막음·막힘·중복·관련·파생 관계(더하기·빼기).

import { X } from "lucide-react";
import { useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { PostRefRow } from "@/entities/post/ui/PostLink";
import { PostPicker } from "@/entities/post/ui/PostPicker";
import { detail } from "@/entities/post/ui/styles";
import { postsApi } from "@/shared/api/feed/posts";
import type { PostRelation, RelationKind } from "@/shared/api/feed/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { itemButton } from "@/shared/ui/button";
import { Select } from "@/shared/ui/Select";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const d = detail();

/** 화면에서 고르는 관계. 막힘은 상대가 이 게시물을 막는 blocks(상대 → 이 게시물)다 */
type RelationChoice =
  | "blocks"
  | "blocked_by"
  | "duplicate"
  | "relates"
  | "derived";

export const RELATION_CHOICES: readonly RelationChoice[] = [
  "blocks",
  "blocked_by",
  "duplicate",
  "relates",
  "derived",
];

const messages = defineMessages({
  ko: {
    choices: {
      blocks: "막음",
      blocked_by: "막힘",
      duplicate: "중복",
      relates: "관련",
      derived: "파생",
    } satisfies Record<RelationChoice, string>,
    title: "관계",
    parent: "상위 이슈",
    removeParent: "상위 이슈 빼기",
    removeParentFailed: "상위 이슈를 빼지 못했습니다",
    setParent: "상위 이슈 정하기",
    setParentFailed: "상위 이슈를 정하지 못했습니다",
    none: "없음",
    children: "하위 이슈",
    childrenResolved: (done: number, total: number) => `${done}/${total} 해결`,
    unlink: (key: string, label: string) => `${key} ${label} 관계 끊기`,
    unlinkFailed: "관계를 끊지 못했습니다",
    add: "관계 더하기",
    kind: "종류",
    target: "관계를 맺을 게시물",
    linkFailed: "관계를 맺지 못했습니다",
  },
  en: {
    choices: {
      blocks: "Blocks",
      blocked_by: "Blocked by",
      duplicate: "Duplicate",
      relates: "Related",
      derived: "Derived",
    },
    title: "Relations",
    parent: "Parent issue",
    removeParent: "Remove parent issue",
    removeParentFailed: "Couldn't remove the parent issue",
    setParent: "Set parent issue",
    setParentFailed: "Couldn't set the parent issue",
    none: "None",
    children: "Sub-issues",
    childrenResolved: (done: number, total: number) =>
      `${done}/${total} resolved`,
    unlink: (key: string, label: string) =>
      `Remove ${label} relation with ${key}`,
    unlinkFailed: "Couldn't remove the relation",
    add: "Add relation",
    kind: "Type",
    target: "Post to link",
    linkFailed: "Couldn't add the relation",
  },
});

export function relationGroup(r: PostRelation): RelationChoice {
  if (r.kind === "blocks")
    return r.direction === "outgoing" ? "blocks" : "blocked_by";
  return r.kind;
}

const kindOf = (c: RelationChoice): RelationKind =>
  c === "blocked_by" ? "blocks" : c;

export function PostRelations({ post }: { post: PostDetail }) {
  const text = useT(messages);
  const { run, pending } = usePostAction();
  const [choice, setChoice] = useState<RelationChoice>("relates");
  const editable = post.permissions.edit;
  const busy = !!pending;
  const linked = new Set([post.id, ...post.relations.map((r) => r.post.id)]);

  const remove = (r: PostRelation) =>
    run("relation", text.unlinkFailed, () =>
      r.direction === "outgoing"
        ? postsApi.removeRelation(post.id, { toId: r.post.id, kind: r.kind })
        : postsApi.removeRelation(r.post.id, { toId: post.id, kind: r.kind }),
    );

  return (
    <section className={d.section()} aria-labelledby="post-relations-title">
      <h2 id="post-relations-title" className={d.sectionTitle()}>
        {text.title}
      </h2>

      <div className="flex flex-col gap-1">
        <h3 className="text-2xs font-semibold text-fg-muted">{text.parent}</h3>
        {post.parent ? (
          <PostRefRow
            post={post.parent}
            aside={
              editable && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label={text.removeParent}
                  disabled={busy}
                  onClick={() =>
                    run("parent", text.removeParentFailed, () =>
                      postsApi.setParent(post.id, null),
                    )
                  }
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )
            }
          />
        ) : editable ? (
          <PostPicker
            label={text.setParent}
            groupId={post.groupId}
            exclude={[post.id, ...post.children.map((c) => c.id)]}
            disabled={busy}
            onPick={(p) =>
              run("parent", text.setParentFailed, () =>
                postsApi.setParent(post.id, p.id),
              )
            }
          />
        ) : (
          <p className={d.hint()}>{text.none}</p>
        )}
      </div>

      {post.children.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-2xs font-semibold text-fg-muted">
            {text.children}{" "}
            <span className="font-normal tabular-nums">
              {text.childrenResolved(post.childResolvedCount, post.childCount)}
            </span>
          </h3>
          <ul className={d.list()}>
            {post.children.map((c) => (
              <li key={c.id}>
                <PostRefRow post={c} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {RELATION_CHOICES.map((id) => {
        const rows = post.relations.filter((r) => relationGroup(r) === id);
        if (rows.length === 0) return null;
        const label = text.choices[id];
        return (
          <div key={id} className="flex flex-col gap-1">
            <h3 className="text-2xs font-semibold text-fg-muted">{label}</h3>
            <ul className={d.list()}>
              {rows.map((r) => (
                <li key={`${r.kind}-${r.direction}-${r.post.id}`}>
                  <PostRefRow
                    post={r.post}
                    aside={
                      editable && (
                        <button
                          type="button"
                          className={itemButton()}
                          aria-label={text.unlink(r.post.key, label)}
                          disabled={busy}
                          onClick={() => remove(r)}
                        >
                          <X size={12} aria-hidden="true" />
                        </button>
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {editable && (
        <div className="flex flex-col gap-1">
          <h3 className="text-2xs font-semibold text-fg-muted">{text.add}</h3>
          <div className="flex items-end gap-1.5">
            <div className="w-24 flex-none">
              <Select
                label={text.kind}
                value={choice}
                options={RELATION_CHOICES.map((id) => ({
                  value: id,
                  label: text.choices[id],
                }))}
                onChange={setChoice}
                disabled={busy}
              />
            </div>
            <PostPicker
              label={text.target}
              exclude={[...linked]}
              disabled={busy}
              onPick={(p) =>
                run("relation", text.linkFailed, () =>
                  choice === "blocked_by"
                    ? postsApi.addRelation(p.id, {
                        toId: post.id,
                        kind: "blocks",
                      })
                    : postsApi.addRelation(post.id, {
                        toId: p.id,
                        kind: kindOf(choice),
                      }),
                )
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
