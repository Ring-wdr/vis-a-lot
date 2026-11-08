"use client";

// 관계: 상위 이슈(정하기·빼기), 하위 이슈, 막음·막힘·중복·관련·파생 관계(더하기·빼기).

import type { MessageDescriptor } from "@lingui/core";
import { msg, ph } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { X } from "lucide-react";
import { useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { PostRefRow } from "@/entities/post/ui/PostLink";
import { PostPicker } from "@/entities/post/ui/PostPicker";
import { detail } from "@/entities/post/ui/styles";
import { postsApi } from "@/shared/api/feed/posts";
import type { PostRelation, RelationKind } from "@/shared/api/feed/types";
import { itemButton } from "@/shared/ui/button";
import { Select } from "@/shared/ui/Select";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";
import "../config/messages";

const d = detail();

/** 화면에서 고르는 관계. 막힘은 상대가 이 게시물을 막는 blocks(상대 → 이 게시물)다 */
type RelationChoice =
  | "blocks"
  | "blocked_by"
  | "duplicate"
  | "relates"
  | "derived";

const CHOICE_LABELS: Record<RelationChoice, MessageDescriptor> = {
  blocks: msg({ message: "막음", context: "relation choice" }),
  blocked_by: msg({ message: "막힘", context: "relation choice" }),
  duplicate: msg({ message: "중복", context: "relation choice" }),
  relates: msg({ message: "관련", context: "relation choice" }),
  derived: msg({ message: "파생", context: "relation choice" }),
};

export const RELATION_CHOICES: readonly RelationChoice[] = [
  "blocks",
  "blocked_by",
  "duplicate",
  "relates",
  "derived",
];

export function relationGroup(r: PostRelation): RelationChoice {
  if (r.kind === "blocks")
    return r.direction === "outgoing" ? "blocks" : "blocked_by";
  return r.kind;
}

const kindOf = (c: RelationChoice): RelationKind =>
  c === "blocked_by" ? "blocks" : c;

export function PostRelations({ post }: { post: PostDetail }) {
  const { t, i18n } = useLingui();
  const { run, pending } = usePostAction();
  const [choice, setChoice] = useState<RelationChoice>("relates");
  const editable = post.permissions.edit;
  const busy = !!pending;
  const linked = new Set([post.id, ...post.relations.map((r) => r.post.id)]);

  const remove = (r: PostRelation) =>
    run("relation", t`관계를 끊지 못했습니다`, () =>
      r.direction === "outgoing"
        ? postsApi.removeRelation(post.id, { toId: r.post.id, kind: r.kind })
        : postsApi.removeRelation(r.post.id, { toId: post.id, kind: r.kind }),
    );

  return (
    <section className={d.section()} aria-labelledby="post-relations-title">
      <h2 id="post-relations-title" className={d.sectionTitle()}>
        <Trans>관계</Trans>
      </h2>

      <div className="flex flex-col gap-1">
        <h3 className="text-2xs font-semibold text-fg-muted">
          <Trans>상위 이슈</Trans>
        </h3>
        {post.parent ? (
          <PostRefRow
            post={post.parent}
            aside={
              editable && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label={t`상위 이슈 빼기`}
                  disabled={busy}
                  onClick={() =>
                    run("parent", t`상위 이슈를 빼지 못했습니다`, () =>
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
            label={t`상위 이슈 정하기`}
            groupId={post.groupId}
            exclude={[post.id, ...post.children.map((c) => c.id)]}
            disabled={busy}
            onPick={(p) =>
              run("parent", t`상위 이슈를 정하지 못했습니다`, () =>
                postsApi.setParent(post.id, p.id),
              )
            }
          />
        ) : (
          <p className={d.hint()}>
            <Trans context="empty field value">없음</Trans>
          </p>
        )}
      </div>

      {post.children.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-2xs font-semibold text-fg-muted">
            <Trans>하위 이슈</Trans>{" "}
            <span className="font-normal tabular-nums">
              {t`${ph({ done: post.childResolvedCount })}/${ph({ total: post.childCount })} 해결`}
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
        const label = i18n._(CHOICE_LABELS[id]);
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
                          aria-label={t`${ph({ key: r.post.key })} ${label} 관계 끊기`}
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
          <h3 className="text-2xs font-semibold text-fg-muted">
            <Trans>관계 더하기</Trans>
          </h3>
          <div className="flex items-end gap-1.5">
            <div className="w-24 flex-none">
              <Select
                label={t`종류`}
                value={choice}
                options={RELATION_CHOICES.map((id) => ({
                  value: id,
                  label: i18n._(CHOICE_LABELS[id]),
                }))}
                onChange={setChoice}
                disabled={busy}
              />
            </div>
            <PostPicker
              label={t`관계를 맺을 게시물`}
              exclude={[...linked]}
              disabled={busy}
              onPick={(p) =>
                run("relation", t`관계를 맺지 못했습니다`, () =>
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
