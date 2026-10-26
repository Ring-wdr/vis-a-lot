/* biome-ignore-all lint/performance/noImgElement: 차트 공유 PNG(data URL)를 그대로 미리 본다. next/image 최적화 대상이 아니다. */
"use client";

// 새 게시물 전체 폼 (/feed/new). ?share=<공유 id>면 vis-a-lot 차트 공유로 차트 게시물을 채운다.

import { useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { Plus, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ai } from "@/feed/ai";
import { invalidatePosts, useChartShareImport } from "@/feed/api/post-queries";
import { postsApi } from "@/feed/api/posts";
import { useGroups } from "@/feed/api/queries";
import type {
  ChartShareImport,
  CreatePostRequest,
  PostFormat,
  PostRef,
} from "@/feed/api/types";
import { FORMAT_LABELS, type PriorityLevel } from "@/feed/lib/labels";
import { cn } from "@/shared/lib/tw";
import { button, itemButton } from "@/shared/ui/button";
import { LoadingText, Spinner } from "@/shared/ui/Loading";
import { OrderedSelect } from "@/shared/ui/OrderedSelect";
import { Select } from "@/shared/ui/Select";
import { segmented } from "@/shared/ui/segmented";
import { josa } from "../post/event-text";
import { NONE, PRIORITY_OPTIONS, useGroupOptions } from "../post/options";
import { postPageHref } from "../post/PostLink";
import { PostPicker } from "../post/PostPicker";
import { defaultGroup } from "../post/quick-create";
import { docText, isEmptyDoc, RichTextEditor } from "../post/rich-text";
import { chip, field, fieldRow } from "../post/styles";
import { TagInput } from "../post/TagInput";
import { errorMessage } from "../post/use-post-action";
import { buildPayload, type FormatInputs, linkRows } from "./payload";

const seg = segmented();
const r = fieldRow();

/** AI가 채운 필드 표시 */
type Suggested = Partial<
  Record<"postTypeId" | "priority" | "assigneeId", true>
>;

const aiChip = (
  <span className={chip({ tone: "accent", class: "h-4.5 px-1.5" })}>
    <Sparkles size={10} aria-hidden="true" />
    AI
  </span>
);

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={r.root()}>
      <label className={r.label()} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="text-2xs text-fg-muted">{hint}</p>}
    </div>
  );
}

/** 차트 공유에서 가져온 내용 미리 보기 */
function SharePreview({
  shareId,
  share,
  isPending,
  error,
}: {
  shareId: string;
  share: ChartShareImport | undefined;
  isPending: boolean;
  error: Error | null;
}) {
  if (isPending)
    return (
      <div className="rounded-lg border border-line bg-elevated p-4">
        <LoadingText>vis-a-lot 차트 공유를 불러오는 중</LoadingText>
      </div>
    );
  if (error || !share)
    return (
      <div
        role="alert"
        className="flex flex-col gap-1 rounded-lg border border-danger/40 bg-danger/12 p-4 text-ui text-danger"
      >
        <strong>차트 공유를 가져오지 못했습니다</strong>
        <span className="text-xs">
          {shareId}: {error?.message ?? "없는 공유"}. 공유가 지워졌거나 다른
          브라우저에서 만든 공유일 수 있습니다. 차트 없이 게시물을 쓸 수
          있습니다.
        </span>
      </div>
    );
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-accent-line bg-accent-soft p-3">
      <img
        src={share.thumbnail}
        alt={`${share.title} 차트`}
        className="block size-auto max-h-80 max-w-full rounded-md bg-elevated object-contain"
      />
      <figcaption className="text-xs text-fg-secondary">
        vis-a-lot 공유에서 가져옴 · {share.createdByName} ·{" "}
        {share.payload.chartType} · {share.payload.dataset}
        {share.payload.item.key !== "all" && ` · ${share.payload.item.label}`}
      </figcaption>
    </figure>
  );
}

export function NewPostView() {
  const search = useSearchParams();
  const shareId = search.get("share");
  const router = useRouter();
  const client = useQueryClient();
  const ids = { title: useId(), due: useId(), checklist: useId() };

  const groups = useGroups();
  const share = useChartShareImport(shareId);

  const [format, setFormat] = useState<PostFormat>(shareId ? "chart" : "image");
  const [groupChoice, setGroupChoice] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>(NONE);
  const [postTypeId, setPostTypeId] = useState<string>(NONE);
  const [priority, setPriority] = useState<PriorityLevel>(2);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<JSONContent | null>(null);
  const [requesterId, setRequesterId] = useState<string>(NONE);
  const [assigneeId, setAssigneeId] = useState<string>(NONE);
  const [stakeholderIds, setStakeholderIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [checklist, setChecklist] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [links, setLinks] = useState<{ name: string; url: string }[]>([]);
  const [parent, setParent] = useState<PostRef | null>(null);
  const [inputs, setInputs] = useState<FormatInputs>({
    imageUrl: "",
    videoUrl: "",
    language: "sql",
    code: "",
  });
  const [suggested, setSuggested] = useState<Suggested>({});
  const [suggesting, setSuggesting] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupList = groups.data ?? [];
  const groupId =
    groupChoice ?? defaultGroup(groupList, search.get("g"))?.id ?? null;
  const o = useGroupOptions(groupId ?? undefined);

  // 차트 공유를 한 번만 채운다 (사용자가 고친 값을 덮지 않는다).
  const filled = useRef(false);
  useEffect(() => {
    const s = share.data;
    if (!s || filled.current) return;
    filled.current = true;
    setFormat("chart");
    setTitle((t) => t || s.title);
    setLinks((l) =>
      l.some((x) => x.url === s.payload.link)
        ? l
        : [{ name: "vis-a-lot 차트", url: s.payload.link }, ...l],
    );
  }, [share.data]);

  const pickGroup = (id: string) => {
    if (id === groupId) return;
    setGroupChoice(id);
    // 그룹마다 팀·유형·멤버가 달라 고른 값을 비운다.
    setTeamId(NONE);
    setPostTypeId(NONE);
    setAssigneeId(NONE);
    setRequesterId(NONE);
    setStakeholderIds([]);
    setParent(null);
    setSuggested({});
  };

  const suggest = async () => {
    if (!title.trim()) {
      setAiNote("제목을 먼저 적어 주세요.");
      return;
    }
    setSuggesting(true);
    setAiNote(null);
    try {
      const s = await ai.suggestFields({
        title: title.trim(),
        body: docText(body),
        postTypes: (o.group?.postTypes ?? []).map((t) => ({
          id: t.id,
          name: t.name,
        })),
        users: o.people.map((p) => ({ id: p.value, name: p.label })),
      });
      const next: Suggested = {};
      if (
        s.postTypeId &&
        o.group?.postTypes.some((t) => t.id === s.postTypeId)
      ) {
        setPostTypeId(s.postTypeId);
        next.postTypeId = true;
      }
      if (
        typeof s.priority === "number" &&
        s.priority >= 0 &&
        s.priority <= 4
      ) {
        setPriority(s.priority as PriorityLevel);
        next.priority = true;
      }
      if (s.assigneeId && o.people.some((p) => p.value === s.assigneeId)) {
        setAssigneeId(s.assigneeId);
        next.assigneeId = true;
      }
      setSuggested(next);
      const names = [
        next.postTypeId && "게시물 유형",
        next.priority && "우선순위",
        next.assigneeId && "담당자",
      ].filter((n): n is string => !!n);
      setAiNote(
        names.length
          ? `AI가 ${josa(names.join("·"), "을/를")} 채웠습니다. 바꿔도 됩니다.`
          : "AI가 추천할 값을 찾지 못했습니다.",
      );
    } catch (err) {
      setAiNote(`AI 추천에 실패했습니다: ${errorMessage(err)}`);
    } finally {
      setSuggesting(false);
    }
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) return setError("제목을 적어 주세요.");
    if (!groupId) return setError("그룹을 골라 주세요.");
    const { payload, thumbnail } = buildPayload(format, inputs, share.data);
    const orNull = (v: string) => (v === NONE ? null : v);
    const req: CreatePostRequest = {
      groupId,
      title: t,
      format,
      priority,
      postTypeId: orNull(postTypeId),
      teamId: orNull(teamId),
      body: isEmptyDoc(body) ? undefined : body,
      payload,
      thumbnail,
      assigneeId: orNull(assigneeId),
      requesterId: orNull(requesterId),
      stakeholderIds,
      dueDate: dueDate || null,
      parentId: parent?.id ?? null,
      checklist: checklist
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      tags,
      attachments: linkRows(links),
    };
    setSaving(true);
    setError(null);
    try {
      const created = await postsApi.create(req);
      await invalidatePosts(client);
      router.push(postPageHref(created.key));
    } catch (err) {
      setError(`만들지 못했습니다: ${errorMessage(err)}`);
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-240 flex-col gap-5 p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">새 게시물</h1>
        <button
          type="button"
          className={button({ size: "sm" })}
          disabled={suggesting || !groupId}
          aria-busy={suggesting}
          title="제목·설명으로 게시물 유형·우선순위·담당자를 추천합니다"
          onClick={suggest}
        >
          {suggesting ? (
            <Spinner size="sm" />
          ) : (
            <Sparkles size={13} aria-hidden="true" />
          )}
          AI 추천
        </button>
      </header>
      {aiNote && (
        <output className="rounded-md bg-accent-soft px-3 py-2 text-xs text-accent">
          {aiNote}
        </output>
      )}

      {shareId && (
        <SharePreview
          shareId={shareId}
          share={share.data}
          isPending={share.isPending}
          error={share.error}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs text-fg-secondary">형식</legend>
            <div className={seg.root()}>
              {(Object.keys(FORMAT_LABELS) as PostFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={seg.item()}
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label="제목 (필수)" htmlFor={ids.title}>
            <input
              id={ids.title}
              className={field({ class: "h-9 text-sm" })}
              value={title}
              maxLength={200}
              aria-invalid={!!error && !title.trim()}
              onChange={(e) => {
                setTitle(e.currentTarget.value);
                setError(null);
              }}
            />
          </Field>

          <div className={r.root()}>
            <span className={r.label()}>설명</span>
            <RichTextEditor initial={null} onChange={setBody} label="설명" />
          </div>

          <FormatInputsFields
            format={format}
            inputs={inputs}
            onChange={setInputs}
            fromShare={!!share.data}
          />

          <Field
            label="체크리스트"
            htmlFor={ids.checklist}
            hint="한 줄에 항목 하나"
          >
            <textarea
              id={ids.checklist}
              className={field({ multiline: true, class: "font-sans text-ui" })}
              rows={3}
              value={checklist}
              onChange={(e) => setChecklist(e.currentTarget.value)}
            />
          </Field>

          <div className={r.root()}>
            <span className={r.label()}>링크 첨부</span>
            {links.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 줄을 지우고 더하는 입력 목록이라 자리가 곧 정체다
              <div key={i} className="flex gap-1.5">
                <input
                  className={field({ class: "w-40 flex-none" })}
                  value={l.name}
                  placeholder="이름"
                  aria-label={`링크 ${i + 1} 이름`}
                  onChange={(e) => {
                    const name = e.currentTarget.value;
                    setLinks((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, name } : x)),
                    );
                  }}
                />
                <input
                  className={field()}
                  value={l.url}
                  placeholder="https://…"
                  aria-label={`링크 ${i + 1} 주소`}
                  onChange={(e) => {
                    const url = e.currentTarget.value;
                    setLinks((ls) =>
                      ls.map((x, j) => (j === i ? { ...x, url } : x)),
                    );
                  }}
                />
                <button
                  type="button"
                  className={cn(itemButton(), "size-7.5 flex-none")}
                  aria-label={`링크 ${i + 1} 빼기`}
                  onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={button({ size: "sm", class: "self-start" })}
              onClick={() => setLinks((ls) => [...ls, { name: "", url: "" }])}
            >
              <Plus size={13} aria-hidden="true" />
              링크 더하기
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-elevated p-3">
          <Select
            label="그룹"
            value={groupId}
            placeholder={groups.isPending ? "불러오는 중" : "그룹 없음"}
            options={groupList.map((g) => ({
              value: g.id,
              label: `${g.name} (${g.keyPrefix})`,
            }))}
            onChange={pickGroup}
          />
          <Select
            label="팀"
            value={teamId}
            options={o.teams}
            onChange={setTeamId}
          />
          <Select
            label="게시물 유형"
            aside={suggested.postTypeId && aiChip}
            value={postTypeId}
            options={o.postTypes}
            onChange={(v) => {
              setPostTypeId(v);
              setSuggested((s) => ({ ...s, postTypeId: undefined }));
            }}
          />
          <Select
            label="우선순위"
            aside={suggested.priority && aiChip}
            value={priority}
            options={PRIORITY_OPTIONS}
            onChange={(v) => {
              setPriority(v);
              setSuggested((s) => ({ ...s, priority: undefined }));
            }}
          />
          <Select
            label="담당자"
            aside={suggested.assigneeId && aiChip}
            value={assigneeId}
            options={o.peopleOrNone}
            onChange={(v) => {
              setAssigneeId(v);
              setSuggested((s) => ({ ...s, assigneeId: undefined }));
            }}
          />
          <div className="flex flex-col gap-1">
            <Select
              label="요청자"
              value={requesterId}
              options={o.peopleOrNone}
              onChange={setRequesterId}
            />
            {requesterId === NONE && (
              <p className="text-2xs text-fg-muted">
                비어 있으면 작성자(나)가 요청자 역할을 합니다.
              </p>
            )}
          </div>
          <OrderedSelect
            label="이해관계자"
            options={o.people}
            value={stakeholderIds}
            placeholder="없음"
            onChange={setStakeholderIds}
          />
          <Field label="기한" htmlFor={ids.due}>
            <input
              id={ids.due}
              type="date"
              className={field()}
              value={dueDate}
              onChange={(e) => setDueDate(e.currentTarget.value)}
            />
          </Field>
          <div className={r.root()}>
            <span className={r.label()}>태그</span>
            <TagInput value={tags} onChange={setTags} />
          </div>
          <div className={r.root()}>
            <span className={r.label()}>상위 이슈 (선택)</span>
            {parent ? (
              <span className="flex min-h-7.5 items-center gap-2 rounded-md bg-panel px-2">
                <span className="text-xs font-semibold text-fg-secondary tabular-nums">
                  {parent.key}
                </span>
                <span className="min-w-0 flex-1 truncate">{parent.title}</span>
                <button
                  type="button"
                  className={itemButton()}
                  aria-label="상위 이슈 빼기"
                  onClick={() => setParent(null)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ) : (
              <PostPicker
                label="상위 이슈"
                groupId={groupId ?? undefined}
                disabled={!groupId}
                onPick={setParent}
              />
            )}
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {error && (
          <p role="alert" className="mr-auto text-xs text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          className={button()}
          onClick={() => router.back()}
        >
          취소
        </button>
        <button
          type="submit"
          className={button({ variant: "primary" })}
          disabled={saving}
          aria-busy={saving}
        >
          {saving && <Spinner size="sm" tone="inherit" />}
          게시물 만들기
        </button>
      </footer>
    </form>
  );
}

/** 형식별 내용 입력: 이미지·동영상 주소, 코드 언어와 코드. 차트는 공유에서만 온다 */
function FormatInputsFields({
  format,
  inputs,
  onChange,
  fromShare,
}: {
  format: PostFormat;
  inputs: FormatInputs;
  onChange: (next: FormatInputs) => void;
  fromShare: boolean;
}) {
  const set = (patch: Partial<FormatInputs>) =>
    onChange({ ...inputs, ...patch });
  const id = useId();
  switch (format) {
    case "chart":
      return fromShare ? null : (
        <p className="text-xs text-fg-muted">
          차트 게시물은 vis-a-lot의 탭 도구 줄이나 공유 페이지에서 &quot;피드에
          올리기&quot;로 만들면 차트 이미지와 링크가 함께 들어옵니다.
        </p>
      );
    case "image":
      return (
        <Field label="이미지 주소" htmlFor={id} hint="썸네일로도 씁니다">
          <input
            id={id}
            className={field()}
            value={inputs.imageUrl}
            placeholder="https://… 또는 data:image/…"
            onChange={(e) => set({ imageUrl: e.currentTarget.value })}
          />
        </Field>
      );
    case "video":
      return (
        <Field label="동영상 주소" htmlFor={id}>
          <input
            id={id}
            className={field()}
            value={inputs.videoUrl}
            placeholder="https://….mp4"
            onChange={(e) => set({ videoUrl: e.currentTarget.value })}
          />
        </Field>
      );
    case "code":
      return (
        <div className="flex flex-col gap-2">
          <Field label="언어" htmlFor={`${id}-lang`}>
            <input
              id={`${id}-lang`}
              className={field({ class: "w-40" })}
              value={inputs.language}
              placeholder="sql, python …"
              onChange={(e) => set({ language: e.currentTarget.value })}
            />
          </Field>
          <Field label="코드" htmlFor={`${id}-code`}>
            <textarea
              id={`${id}-code`}
              className={field({ multiline: true })}
              rows={8}
              spellCheck={false}
              value={inputs.code}
              onChange={(e) => set({ code: e.currentTarget.value })}
            />
          </Field>
        </div>
      );
  }
}
