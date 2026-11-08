"use client";

// 게시물 유형: 색 + 이름 목록. 추가, 이름 바꾸기, 색 바꾸기(미리 정한 색), 순서 바꾸기, 지우기.

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
import { defineMessages, useT } from "@/shared/lib/i18n";
import { showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "@/shared/ui/feed-settings-styles";
import type { useGroupEdit } from "@/views/feed-settings-group/model/use-group-edit";

const s = settings();

/** 게시물 유형 색. 시드의 기본 유형 색 + 몇 가지. 이름은 messages.colors */
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

const messages = defineMessages({
  ko: {
    colors: {
      red: "빨강",
      orange: "주황",
      yellow: "노랑",
      green: "초록",
      teal: "청록",
      blue: "파랑",
      purple: "보라",
      pink: "분홍",
      gray: "회색",
    } as Record<ColorKey, string>,
    noColor: "색 없음",
    saveFailed: "게시물 유형을 저장하지 못했습니다",
    createFailed: "게시물 유형을 만들지 못했습니다",
    renamePrompt: "게시물 유형 이름",
    renameConfirm: "바꾸기",
    sortFailed: "순서를 바꾸지 못했습니다",
    removeConfirm: (name: string) =>
      `게시물 유형 '${name}'을(를) 지울까요? 이 유형의 게시물은 유형 없음이 됩니다.`,
    remove: "지우기",
    removeFailed: "게시물 유형을 지우지 못했습니다",
    title: "게시물 유형",
    hint: "게시물마다 하나를 고르는 라벨입니다.",
    empty: "아직 게시물 유형이 없습니다.",
    colorOf: (color: string) => `색: ${color}`,
    up: "위로",
    upOf: (name: string) => `${name} 위로`,
    down: "아래로",
    downOf: (name: string) => `${name} 아래로`,
    recolor: "색 바꾸기",
    recolorOf: (name: string) => `${name} 색 바꾸기`,
    rename: "이름 바꾸기",
    renameOf: (name: string) => `${name} 이름 바꾸기`,
    removeOf: (name: string) => `${name} 지우기`,
    colorLabel: (name: string) => `${name} 색`,
    newType: "새 유형",
    newTypePlaceholder: "예: 개선",
    newTypeColor: "새 유형 색",
    add: "추가",
  },
  en: {
    colors: {
      red: "Red",
      orange: "Orange",
      yellow: "Yellow",
      green: "Green",
      teal: "Teal",
      blue: "Blue",
      purple: "Purple",
      pink: "Pink",
      gray: "Gray",
    },
    noColor: "No color",
    saveFailed: "Couldn't save the post type",
    createFailed: "Couldn't create the post type",
    renamePrompt: "Post type name",
    renameConfirm: "Rename",
    sortFailed: "Couldn't reorder",
    removeConfirm: (name: string) =>
      `Delete post type '${name}'? Posts of this type will have no type.`,
    remove: "Delete",
    removeFailed: "Couldn't delete the post type",
    title: "Post types",
    hint: "A label each post picks one of.",
    empty: "No post types yet.",
    colorOf: (color: string) => `Color: ${color}`,
    up: "Move up",
    upOf: (name: string) => `Move ${name} up`,
    down: "Move down",
    downOf: (name: string) => `Move ${name} down`,
    recolor: "Change color",
    recolorOf: (name: string) => `Change ${name} color`,
    rename: "Rename",
    renameOf: (name: string) => `Rename ${name}`,
    removeOf: (name: string) => `Delete ${name}`,
    colorLabel: (name: string) => `${name} color`,
    newType: "New type",
    newTypePlaceholder: "e.g. Improvement",
    newTypeColor: "New type color",
    add: "Add",
  },
});

type Text = (typeof messages)["ko"];

const colorName = (text: Text, hex: string | null) => {
  const c = TYPE_COLORS.find((c) => c.hex === hex?.toLowerCase());
  return c ? text.colors[c.key] : (hex ?? text.noColor);
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
  const text = useT(messages);
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      {TYPE_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          className="size-6 cursor-pointer rounded-full border-2 border-elevated ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-fg"
          style={{ background: c.hex }}
          aria-label={text.colors[c.key]}
          title={text.colors[c.key]}
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
  const text = useT(messages);
  const id = useId();
  const types = [...group.postTypes].sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name),
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TYPE_COLORS[5].hex);
  const [coloring, setColoring] = useState<string | null>(null);
  const busy = !!edit.pending;

  const save = (t: PostType, patch: Partial<PostType>) =>
    edit.run(`type-${t.id}`, text.saveFailed, () =>
      groupsApi.savePostType(group.id, {
        id: t.id,
        name: patch.name ?? t.name,
        color: patch.color !== undefined ? patch.color : t.color,
        sort: patch.sort ?? t.sort,
      }),
    );

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    const ok = await edit.run("type-add", text.createFailed, () =>
      groupsApi.savePostType(group.id, { name: n, color }),
    );
    if (ok) setName("");
  };

  const rename = async (t: PostType) => {
    const next = await showPrompt(text.renamePrompt, {
      defaultValue: t.name,
      confirmLabel: text.renameConfirm,
      maxLength: 30,
    });
    if (next && next !== t.name) await save(t, { name: next });
  };

  const move = (from: number, to: number) =>
    edit.run("type-sort", text.sortFailed, async () => {
      let last: GroupDetail | undefined;
      for (const t of reorder(types, from, to))
        last = await groupsApi.savePostType(group.id, {
          id: t.id,
          name: t.name,
          color: t.color,
          sort: t.sort,
        });
      return last;
    });

  const remove = async (t: PostType) => {
    const ok = await showConfirm(text.removeConfirm(t.name), {
      confirmLabel: text.remove,
    });
    if (ok)
      await edit.run(
        `type-${t.id}`,
        text.removeFailed,
        () => groupsApi.deletePostType(group.id, t.id),
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
      {types.length === 0 ? (
        <p className={s.hint()}>{text.empty}</p>
      ) : (
        <ul className={s.list()}>
          {types.map((t, i) => (
            <li key={t.id} className={s.item()}>
              <Swatch color={t.color} />
              <span className={s.itemName()}>{t.name}</span>
              <span className="sr-only">
                {text.colorOf(colorName(text, t.color))}
              </span>
              <span className={s.actions()}>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={text.upOf(t.name)}
                  title={text.up}
                  disabled={busy || i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={text.downOf(t.name)}
                  title={text.down}
                  disabled={busy || i === types.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={text.recolorOf(t.name)}
                  title={text.recolor}
                  aria-expanded={coloring === t.id}
                  disabled={busy}
                  onClick={() => setColoring((c) => (c === t.id ? null : t.id))}
                >
                  <Palette size={14} aria-hidden="true" />
                </button>
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
              {coloring === t.id && (
                <div className="basis-full pl-5.5">
                  <ColorPicker
                    label={text.colorLabel(t.name)}
                    value={t.color}
                    onSelect={async (hex) => {
                      if (await save(t, { color: hex })) setColoring(null);
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
          {text.newType}
          <input
            className={field()}
            value={name}
            maxLength={30}
            placeholder={text.newTypePlaceholder}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <ColorPicker
          label={text.newTypeColor}
          value={color}
          onSelect={setColor}
        />
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
