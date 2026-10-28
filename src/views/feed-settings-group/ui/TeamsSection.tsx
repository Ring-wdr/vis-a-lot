"use client";

// 팀: 그룹 안의 스윔레인·필터. 추가, 이름 바꾸기, 지우기.

import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useId, useState } from "react";
import { field } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type { GroupDetail, Team } from "@/shared/api/feed/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "@/shared/ui/feed-settings-styles";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";

const messages = defineMessages({
  ko: {
    createFailed: "팀을 만들지 못했습니다",
    renamePrompt: "팀 이름",
    renameConfirm: "바꾸기",
    renameFailed: "팀 이름을 바꾸지 못했습니다",
    removeConfirm: (name: string) =>
      `팀 '${name}'을(를) 지울까요? 이 팀의 게시물은 팀 없음이 됩니다.`,
    remove: "지우기",
    removeFailed: "팀을 지우지 못했습니다",
    title: "팀",
    hint: "보드의 스윔레인과 필터에 씁니다.",
    empty: "아직 팀이 없습니다.",
    rename: "이름 바꾸기",
    renameOf: (name: string) => `${name} 이름 바꾸기`,
    removeOf: (name: string) => `${name} 지우기`,
    newTeam: "새 팀",
    newTeamPlaceholder: "예: 데이터팀",
    add: "추가",
  },
  en: {
    createFailed: "Couldn't create the team",
    renamePrompt: "Team name",
    renameConfirm: "Rename",
    renameFailed: "Couldn't rename the team",
    removeConfirm: (name: string) =>
      `Delete team '${name}'? Posts in this team will have no team.`,
    remove: "Delete",
    removeFailed: "Couldn't delete the team",
    title: "Teams",
    hint: "Used for board swimlanes and filters.",
    empty: "No teams yet.",
    rename: "Rename",
    renameOf: (name: string) => `Rename ${name}`,
    removeOf: (name: string) => `Delete ${name}`,
    newTeam: "New team",
    newTeamPlaceholder: "e.g. Data team",
    add: "Add",
  },
});

const s = settings();

export function TeamsSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const text = useT(messages);
  const id = useId();
  const [name, setName] = useState("");
  const busy = !!edit.pending;

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const ok = await edit.run("team-add", text.createFailed, () =>
      groupsApi.saveTeam(group.id, { name: n }),
    );
    if (ok) setName("");
  };

  const rename = async (t: Team) => {
    const next = await showPrompt(text.renamePrompt, {
      defaultValue: t.name,
      confirmLabel: text.renameConfirm,
      maxLength: 40,
    });
    if (next && next !== t.name)
      await edit.run(
        `team-${t.id}`,
        text.renameFailed,
        () => groupsApi.saveTeam(group.id, { id: t.id, name: next }),
        { posts: true },
      );
  };

  const remove = async (t: Team) => {
    const ok = await showConfirm(text.removeConfirm(t.name), {
      confirmLabel: text.remove,
    });
    if (ok)
      await edit.run(
        `team-${t.id}`,
        text.removeFailed,
        () => groupsApi.deleteTeam(group.id, t.id),
        { posts: true },
      );
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          {text.title}
        </h2>
        <p className={s.hint()}>{text.hint}</p>
      </div>
      {group.teams.length === 0 ? (
        <p className={s.hint()}>{text.empty}</p>
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
                  aria-label={text.renameOf(t.name)}
                  title={text.rename}
                  disabled={busy}
                  onClick={() => rename(t)}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton({ tone: "danger" })}
                  aria-label={text.removeOf(t.name)}
                  title={text.remove}
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
          void add();
        }}
      >
        <label className={s.label({ class: "w-full max-w-60 flex-1" })}>
          {text.newTeam}
          <input
            className={field()}
            value={name}
            maxLength={40}
            placeholder={text.newTeamPlaceholder}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <button
          type="submit"
          className={button({ size: "sm" })}
          disabled={busy || !name.trim()}
        >
          <Plus size={14} aria-hidden="true" />
          {text.add}
        </button>
      </form>
    </section>
  );
}
