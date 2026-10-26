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

export const RELATION_GROUPS: { id: RelationChoice; label: string }[] = [
  { id: "blocks", label: "막음" },
  { id: "blocked_by", label: "막힘" },
  { id: "duplicate", label: "중복" },
  { id: "relates", label: "관련" },
  { id: "derived", label: "파생" },
];

export function relationGroup(r: PostRelation): RelationChoice {
  if (r.kind === "blocks")
    return r.direction === "outgoing" ? "blocks" : "blocked_by";
  return r.kind;
}

const kindOf = (c: RelationChoice): RelationKind =>
  c === "blocked_by" ? "blocks" : c;

export function PostRelations({ post }: { post: PostDetail }) {
  const { run, pending } = usePostAction();
  const [choice, setChoice] = useState<RelationChoice>("relates");
  const editable = post.permissions.edit;
  const busy = !!pending;
  const linked = new Set([post.id, ...post.relations.map((r) => r.post.id)]);

  const remove = (r: PostRelation) =>
    run("relation", "관계를 끊지 못했습니다", () =>
      r.direction === "outgoing"
        ? postsApi.removeRelation(post.id, { toId: r.post.id, kind: r.kind })
        : postsApi.removeRelation(r.post.id, { toId: post.id, kind: r.kind }),
    );

  return (
    <section className={d.section()} aria-labelledby="post-relations-title">
      <h2 id="post-relations-title" className={d.sectionTitle()}>
        관계
      </h2>

      <div className="flex flex-col gap-1">
        <h3 className="text-2xs font-semibold text-fg-muted">상위 이슈</h3>
        {post.parent ? (
          <PostRefRow
            post={post.parent}
            aside={
              editable && (
                <button
                  type="button"
                  className={itemButton()}
                  aria-label="상위 이슈 빼기"
                  disabled={busy}
                  onClick={() =>
                    run("parent", "상위 이슈를 빼지 못했습니다", () =>
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
            label="상위 이슈 정하기"
            groupId={post.groupId}
            exclude={[post.id, ...post.children.map((c) => c.id)]}
            disabled={busy}
            onPick={(p) =>
              run("parent", "상위 이슈를 정하지 못했습니다", () =>
                postsApi.setParent(post.id, p.id),
              )
            }
          />
        ) : (
          <p className={d.hint()}>없음</p>
        )}
      </div>

      {post.children.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-2xs font-semibold text-fg-muted">
            하위 이슈{" "}
            <span className="font-normal tabular-nums">
              {post.childResolvedCount}/{post.childCount} 해결
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

      {RELATION_GROUPS.map((g) => {
        const rows = post.relations.filter((r) => relationGroup(r) === g.id);
        if (rows.length === 0) return null;
        return (
          <div key={g.id} className="flex flex-col gap-1">
            <h3 className="text-2xs font-semibold text-fg-muted">{g.label}</h3>
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
                          aria-label={`${r.post.key} ${g.label} 관계 끊기`}
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
          <h3 className="text-2xs font-semibold text-fg-muted">관계 더하기</h3>
          <div className="flex items-end gap-1.5">
            <div className="w-24 flex-none">
              <Select
                label="종류"
                value={choice}
                options={RELATION_GROUPS.map((g) => ({
                  value: g.id,
                  label: g.label,
                }))}
                onChange={setChoice}
                disabled={busy}
              />
            </div>
            <PostPicker
              label="관계를 맺을 게시물"
              exclude={[...linked]}
              disabled={busy}
              onPick={(p) =>
                run("relation", "관계를 맺지 못했습니다", () =>
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
