"use client";

// 게시물 유형: 색 + 이름 목록. 추가, 이름 바꾸기, 색 바꾸기(미리 정한 색), 순서 바꾸기, 지우기.

import type { I18n, MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  ArrowDown,
  ArrowUp,
  Palette,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { field } from "@/entities/post/ui/styles";
import { groupsApi } from "@/shared/api/feed/groups";
import type { GroupDetail, PostType } from "@/shared/api/feed/types";
import { showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "@/shared/ui/feed-settings-styles";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";
import "../config/messages";

const s = settings();

/** 게시물 유형 색. 시드의 기본 유형 색 + 몇 가지. 이름은 COLOR_LABELS */
export const TYPE_COLORS = [
  { key: "red", hex: "#e5484d" },
  { key: "orange", hex: "#f76b15" },
  { key: "yellow", hex: "#f5a524" },
  { key: "green", hex: "#30a46c" },
  { key: "teal", hex: "#12a594" },
  { key: "blue", hex: "#3e63dd" },
  { key: "purple", hex: "#8e4ec6" },
  { key: "pink", hex: "#d6409f" },
  { key: "gray", hex: "#8b8d98" },
] as const;

type ColorKey = (typeof TYPE_COLORS)[number]["key"];

const COLOR_LABELS: Record<ColorKey, MessageDescriptor> = {
  red: msg({ message: "빨강", context: "post type color" }),
  orange: msg({ message: "주황", context: "post type color" }),
  yellow: msg({ message: "노랑", context: "post type color" }),
  green: msg({ message: "초록", context: "post type color" }),
  teal: msg({ message: "청록", context: "post type color" }),
  blue: msg({ message: "파랑", context: "post type color" }),
  purple: msg({ message: "보라", context: "post type color" }),
  pink: msg({ message: "분홍", context: "post type color" }),
  gray: msg({ message: "회색", context: "post type color" }),
};

const NO_COLOR = msg`색 없음`;

const colorName = (i18n: I18n, hex: string | null) => {
  const c = TYPE_COLORS.find((c) => c.hex === hex?.toLowerCase());
  return c ? i18n._(COLOR_LABELS[c.key]) : (hex ?? i18n._(NO_COLOR));
};

export function Swatch({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block size-3.5 flex-none rounded-full border border-line"
      style={color ? { background: color } : undefined}
      aria-hidden="true"
    />
  );
}

function ColorPicker({
  value,
  onSelect,
  label,
}: {
  value: string | null;
  onSelect: (hex: string) => void;
  label: string;
}) {
  const { i18n } = useLingui();
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      {TYPE_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          className="size-6 cursor-pointer rounded-full border-2 border-elevated ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-fg"
          style={{ background: c.hex }}
          aria-label={i18n._(COLOR_LABELS[c.key])}
          title={i18n._(COLOR_LABELS[c.key])}
          aria-pressed={c.hex === value?.toLowerCase()}
          onClick={() => onSelect(c.hex)}
        />
      ))}
    </fieldset>
  );
}

/** 순서를 바꾼 목록에서 sort가 달라진 유형만 (0부터 다시 매긴다) */
export function reorder(types: PostType[], from: number, to: number) {
  const next = [...types];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next
    .map((t, i) => ({ ...t, sort: i }))
    .filter((t, i) => types.find((o) => o.id === t.id)?.sort !== i);
}

export function PostTypesSection({
  group,
  edit,
}: {
  group: GroupDetail;
  edit: ReturnType<typeof useGroupEdit>;
}) {
  const { t, i18n } = useLingui();
  const id = useId();
  const types = [...group.postTypes].sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name),
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TYPE_COLORS[5].hex);
  const [coloring, setColoring] = useState<string | null>(null);
  const busy = !!edit.pending;
  const colorOf = (color: string) => t`색: ${color}`;
  const upOf = (name: string) => t`${name} 위로`;
  const downOf = (name: string) => t`${name} 아래로`;
  const recolorOf = (name: string) => t`${name} 색 바꾸기`;
  const renameOf = (name: string) => t`${name} 이름 바꾸기`;
  const removeOf = (name: string) => t`${name} 지우기`;
  const colorLabel = (name: string) => t`${name} 색`;

  const save = (pt: PostType, patch: Partial<PostType>) =>
    edit.run(`type-${pt.id}`, t`게시물 유형을 저장하지 못했습니다`, () =>
      groupsApi.savePostType(group.id, {
        id: pt.id,
        name: patch.name ?? pt.name,
        color: patch.color !== undefined ? patch.color : pt.color,
        sort: patch.sort ?? pt.sort,
      }),
    );

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const ok = await edit.run(
      "type-add",
      t`게시물 유형을 만들지 못했습니다`,
      () => groupsApi.savePostType(group.id, { name: n, color }),
    );
    if (ok) setName("");
  };

  const rename = async (pt: PostType) => {
    const next = await showPrompt(
      t({ message: "게시물 유형 이름", context: "post type name prompt" }),
      {
        defaultValue: pt.name,
        confirmLabel: t({
          message: "바꾸기",
          context: "confirm renaming a post type",
        }),
        maxLength: 30,
      },
    );
    if (next && next !== pt.name) await save(pt, { name: next });
  };

  const move = (from: number, to: number) =>
    edit.run("type-sort", t`순서를 바꾸지 못했습니다`, async () => {
      let last: GroupDetail | undefined;
      for (const pt of reorder(types, from, to))
        last = await groupsApi.savePostType(group.id, {
          id: pt.id,
          name: pt.name,
          color: pt.color,
          sort: pt.sort,
        });
      return last;
    });

  const remove = async (pt: PostType) => {
    const typeName = pt.name;
    const ok = await showConfirm(
      t`게시물 유형 ''${typeName}''을(를) 지울까요? 이 유형의 게시물은 유형 없음이 됩니다.`,
      {
        confirmLabel: t({ message: "지우기", context: "delete a post type" }),
      },
    );
    if (ok)
      await edit.run(
        `type-${pt.id}`,
        t`게시물 유형을 지우지 못했습니다`,
        () => groupsApi.deletePostType(group.id, pt.id),
        { posts: true },
      );
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          <Trans context="group settings section title">게시물 유형</Trans>
        </h2>
        <p className={s.hint()}>
          <Trans>게시물마다 하나를 고르는 라벨입니다.</Trans>
        </p>
      </div>
      {types.length === 0 ? (
        <p className={s.hint()}>
          <Trans>아직 게시물 유형이 없습니다.</Trans>
        </p>
      ) : (
        <ul className={s.list()}>
          {types.map((pt, i) => (
            <li key={pt.id} className={s.item()}>
              <Swatch color={pt.color} />
              <span className={s.itemName()}>{pt.name}</span>
              <span className="sr-only">
                {colorOf(colorName(i18n, pt.color))}
              </span>
              <span className={s.actions()}>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={upOf(pt.name)}
                  title={t({ message: "위로", context: "move a post type up" })}
                  disabled={busy || i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={downOf(pt.name)}
                  title={t({
                    message: "아래로",
                    context: "move a post type down",
                  })}
                  disabled={busy || i === types.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={recolorOf(pt.name)}
                  title={t({
                    message: "색 바꾸기",
                    context: "change a post type color",
                  })}
                  aria-expanded={coloring === pt.id}
                  disabled={busy}
                  onClick={() =>
                    setColoring((c) => (c === pt.id ? null : pt.id))
                  }
                >
                  <Palette size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={renameOf(pt.name)}
                  title={t({
                    message: "이름 바꾸기",
                    context: "rename a post type",
                  })}
                  disabled={busy}
                  onClick={() => rename(pt)}
                >
                  <Pencil size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton({ tone: "danger" })}
                  aria-label={removeOf(pt.name)}
                  title={t({
                    message: "지우기",
                    context: "delete a post type",
                  })}
                  disabled={busy}
                  onClick={() => remove(pt)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
              {coloring === pt.id && (
                <div className="basis-full pl-5.5">
                  <ColorPicker
                    label={colorLabel(pt.name)}
                    value={pt.color}
                    onSelect={async (hex) => {
                      if (await save(pt, { color: hex })) setColoring(null);
                    }}
                  />
                </div>
              )}
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
          <Trans>새 유형</Trans>
          <input
            className={field()}
            value={name}
            maxLength={30}
            placeholder={t`예: 개선`}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <ColorPicker label={t`새 유형 색`} value={color} onSelect={setColor} />
        <button
          type="submit"
          className={button({ size: "sm" })}
          disabled={busy || !name.trim()}
        >
          <Plus size={14} aria-hidden="true" />
          <Trans context="add a post type">추가</Trans>
        </button>
      </form>
    </section>
  );
}
