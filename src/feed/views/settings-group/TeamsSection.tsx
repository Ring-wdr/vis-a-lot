"use client";

// 팀: 그룹 안의 스윔레인·필터. 추가, 이름 바꾸기, 지우기.

import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useId, useState } from "react";
import { groupsApi } from "@/feed/api/groups";
import type { GroupDetail, Team } from "@/feed/api/types";
import { field } from "@/feed/views/post/styles";
import { showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "./styles";
import type { useGroupEdit } from "./use-group-edit";

const s = settings();

export function TeamsSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const id = useId();
  const [name, setName] = useState("");
  const busy = !!edit.pending;

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const ok = await edit.run("team-add", "팀을 만들지 못했습니다", () =>
      groupsApi.saveTeam(group.id, { name: n }),
    );
    if (ok) setName("");
  };

  const rename = async (t: Team) => {
    const next = await showPrompt("팀 이름", {
      defaultValue: t.name,
      confirmLabel: "바꾸기",
      maxLength: 40,
    });
    if (next && next !== t.name)
      await edit.run(
        `team-${t.id}`,
        "팀 이름을 바꾸지 못했습니다",
        () => groupsApi.saveTeam(group.id, { id: t.id, name: next }),
        { posts: true },
      );
  };

  const remove = async (t: Team) => {
    const ok = await showConfirm(
      `팀 '${t.name}'을(를) 지울까요? 이 팀의 게시물은 팀 없음이 됩니다.`,
      { confirmLabel: "지우기" },
    );
    if (ok)
      await edit.run(
        `team-${t.id}`,
        "팀을 지우지 못했습니다",
        () => groupsApi.deleteTeam(group.id, t.id),
        { posts: true },
      );
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          팀
        </h2>
        <p className={s.hint()}>보드의 스윔레인과 필터에 씁니다.</p>
      </div>
      {group.teams.length === 0 ? (
        <p className={s.hint()}>아직 팀이 없습니다.</p>
      ) : (
        <ul className={s.list()}>
          {group.teams.map((t) => (
            <li key={t.id} className={s.item()}>
              <UsersRound
                size={14}
                className="flex-none text-fg-muted"
                aria-hidden="true"
              />
              <span className={s.itemName()}>{t.name}</span>
              <span className={s.actions()}>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={`${t.name} 이름 바꾸기`}
                  title="이름 바꾸기"
                  disabled={busy}
                  onClick={() => rename(t)}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton({ tone: "danger" })}
                  aria-label={`${t.name} 지우기`}
                  title="지우기"
                  disabled={busy}
                  onClick={() => remove(t)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className={s.addRow()}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className={s.label({ class: "w-full max-w-60 flex-1" })}>
          새 팀
          <input
            className={field()}
            value={name}
            maxLength={40}
            placeholder="예: 데이터팀"
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <button
          type="submit"
          className={button({ size: "sm" })}
          disabled={busy || !name.trim()}
        >
          <Plus size={14} aria-hidden="true" />
          추가
        </button>
      </form>
    </section>
  );
}
