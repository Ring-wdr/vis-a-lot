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
import { groupsApi } from "@/feed/api/groups";
import type { GroupDetail, PostType } from "@/feed/api/types";
import { field } from "@/feed/views/post/styles";
import { showConfirm, showPrompt } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { iconButton, settings } from "./styles";
import type { useGroupEdit } from "./use-group-edit";

const s = settings();

/** 게시물 유형 색. 시드의 기본 유형 색 + 몇 가지 */
export const TYPE_COLORS = [
  { name: "빨강", hex: "#e5484d" },
  { name: "주황", hex: "#f76b15" },
  { name: "노랑", hex: "#f5a524" },
  { name: "초록", hex: "#30a46c" },
  { name: "청록", hex: "#12a594" },
  { name: "파랑", hex: "#3e63dd" },
  { name: "보라", hex: "#8e4ec6" },
  { name: "분홍", hex: "#d6409f" },
  { name: "회색", hex: "#8b8d98" },
] as const;

const colorName = (hex: string | null) =>
  TYPE_COLORS.find((c) => c.hex === hex?.toLowerCase())?.name ??
  hex ??
  "색 없음";

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
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      {TYPE_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          className="size-6 cursor-pointer rounded-full border-2 border-elevated ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-fg"
          style={{ background: c.hex }}
          aria-label={c.name}
          title={c.name}
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
  const id = useId();
  const types = [...group.postTypes].sort(
    (a, b) => a.sort - b.sort || a.name.localeCompare(b.name),
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TYPE_COLORS[5].hex);
  const [coloring, setColoring] = useState<string | null>(null);
  const busy = !!edit.pending;

  const save = (t: PostType, patch: Partial<PostType>) =>
    edit.run(`type-${t.id}`, "게시물 유형을 저장하지 못했습니다", () =>
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
    const ok = await edit.run(
      "type-add",
      "게시물 유형을 만들지 못했습니다",
      () => groupsApi.savePostType(group.id, { name: n, color }),
    );
    if (ok) setName("");
  };

  const rename = async (t: PostType) => {
    const next = await showPrompt("게시물 유형 이름", {
      defaultValue: t.name,
      confirmLabel: "바꾸기",
      maxLength: 30,
    });
    if (next && next !== t.name) await save(t, { name: next });
  };

  const move = (from: number, to: number) =>
    edit.run("type-sort", "순서를 바꾸지 못했습니다", async () => {
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
    const ok = await showConfirm(
      `게시물 유형 '${t.name}'을(를) 지울까요? 이 유형의 게시물은 유형 없음이 됩니다.`,
      { confirmLabel: "지우기" },
    );
    if (ok)
      await edit.run(
        `type-${t.id}`,
        "게시물 유형을 지우지 못했습니다",
        () => groupsApi.deletePostType(group.id, t.id),
        { posts: true },
      );
  };

  return (
    <section className={s.section()} aria-labelledby={`${id}-title`}>
      <div className={s.sectionHead()}>
        <h2 id={`${id}-title`} className={s.sectionTitle()}>
          게시물 유형
        </h2>
        <p className={s.hint()}>게시물마다 하나를 고르는 라벨입니다.</p>
      </div>
      {types.length === 0 ? (
        <p className={s.hint()}>아직 게시물 유형이 없습니다.</p>
      ) : (
        <ul className={s.list()}>
          {types.map((t, i) => (
            <li key={t.id} className={s.item()}>
              <Swatch color={t.color} />
              <span className={s.itemName()}>{t.name}</span>
              <span className="sr-only">색: {colorName(t.color)}</span>
              <span className={s.actions()}>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={`${t.name} 위로`}
                  title="위로"
                  disabled={busy || i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={`${t.name} 아래로`}
                  title="아래로"
                  disabled={busy || i === types.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={iconButton()}
                  aria-label={`${t.name} 색 바꾸기`}
                  title="색 바꾸기"
                  aria-expanded={coloring === t.id}
                  disabled={busy}
                  onClick={() => setColoring((c) => (c === t.id ? null : t.id))}
                >
                  <Palette size={14} aria-hidden="true" />
                </button>
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
              {coloring === t.id && (
                <div className="basis-full pl-5.5">
                  <ColorPicker
                    label={`${t.name} 색`}
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
          add();
        }}
      >
        <label className={s.label({ class: "w-full max-w-60 flex-1" })}>
          새 유형
          <input
            className={field()}
            value={name}
            maxLength={30}
            placeholder="예: 개선"
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <ColorPicker label="새 유형 색" value={color} onSelect={setColor} />
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
