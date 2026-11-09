"use client";

// 팀: 그룹 안의 스윔레인·필터. 추가, 이름 바꾸기, 지우기.

import { Trans, useLingui } from "@lingui/react/macro";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useId, useState } from "react";
import { field } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type { GroupDetail, Team } from "@/shared/api/feed/types";
import { showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "@/shared/ui/feed-settings-styles";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";
import "../config/messages";

const s = settings();

export function TeamsSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const { t } = useLingui();
  const id = useId();
  const [name, setName] = useState("");
  const busy = !!edit.pending;
  const renameOf = (name: string) => t`${name} 이름 바꾸기`;
  const removeOf = (name: string) => t`${name} 지우기`;

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const ok = await edit.run("team-add", t`팀을 만들지 못했습니다`, () =>
      groupsApi.saveTeam(group.id, { name: n }),
    );
    if (ok) setName("");
  };

  const rename = async (team: Team) => {
    const next = await showPrompt(
      t({ message: "팀 이름", context: "team name prompt" }),
      {
        defaultValue: team.name,
        confirmLabel: t({
          message: "바꾸기",
          context: "confirm renaming a team",
        }),
        maxLength: 40,
      },
    );
    if (next && next !== team.name)
      await edit.run(
        `team-${team.id}`,
        t`팀 이름을 바꾸지 못했습니다`,
        () => groupsApi.saveTeam(group.id, { id: team.id, name: next }),
        { posts: true },
      );
  };

  const remove = async (team: Team) => {
    const teamName = team.name;
    const ok = await showConfirm(
      t`팀 ''${teamName}''을(를) 지울까요? 이 팀의 게시물은 팀 없음이 됩니다.`,
      {
        confirmLabel: t({ message: "지우기", context: "delete a team" }),
      },
    );
    if (ok)
      await edit.run(
        `team-${team.id}`,
        t`팀을 지우지 못했습니다`,
        () => groupsApi.deleteTeam(group.id, team.id),
        { posts: true },
      );
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          <Trans context="group settings section title">팀</Trans>
        </h2>
        <p className={s.hint()}>
          <Trans>보드의 스윔레인과 필터에 씁니다.</Trans>
        </p>
      </div>
      {group.teams.length === 0 ? (
        <p className={s.hint()}>
          <Trans>아직 팀이 없습니다.</Trans>
        </p>
      ) : (
        <ul className={s.list()}>
          {group.teams.map((team) => (
            <li key={team.id} className={s.item()}>
              <UsersRound
                size={14}
                className="flex-none text-fg-muted"
                aria-hidden="true"
              />
              <span className={s.itemName()}>{team.name}</span>
              <span className={s.actions()}>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={renameOf(team.name)}
                  title={t({
                    message: "이름 바꾸기",
                    context: "rename a team",
                  })}
                  disabled={busy}
                  onClick={() => rename(team)}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton({ tone: "danger" })}
                  aria-label={removeOf(team.name)}
                  title={t({ message: "지우기", context: "delete a team" })}
                  disabled={busy}
                  onClick={() => remove(team)}
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
          <Trans>새 팀</Trans>
          <input
            className={field()}
            value={name}
            maxLength={40}
            placeholder={t`예: 데이터팀`}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <button
          type="submit"
          className={button({ size: "sm" })}
          disabled={busy || !name.trim()}
        >
          <Plus size={14} aria-hidden="true" />
          <Trans context="add a team">추가</Trans>
        </button>
      </form>
    </section>
  );
}
