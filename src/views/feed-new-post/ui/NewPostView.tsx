/* biome-ignore-all lint/performance/noImgElement: 차트 공유 PNG(data URL)를 그대로 미리 본다. next/image 최적화 대상이 아니다. */
"use client";

// 새 게시물 전체 폼 (/feed/new). ?share=<공유 id>면 vis-a-lot 차트 공유로 차트 게시물을 채운다.

import { select } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { Plus, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { batchim } from "@/entities/post/lib/event-text";
import { formatLabels, type PriorityLevel } from "@/entities/post/lib/labels";
import {
  NONE,
  priorityOptions,
  useGroupOptions,
} from "@/entities/post/model/options";
import { errorMessage } from "@/entities/post/model/use-post-action";
import { postPageHref } from "@/entities/post/ui/PostLink";
import { PostPicker } from "@/entities/post/ui/PostPicker";
import { chip, field, fieldRow } from "@/entities/post/ui/styles";
import { TagInput } from "@/entities/post/ui/TagInput";
import { defaultGroup } from "@/features/create-post/ui/quick-create";
import {
  invalidatePosts,
  useChartShareImport,
} from "@/shared/api/feed/post-queries";
import { postsApi } from "@/shared/api/feed/posts";
import { useGroups } from "@/shared/api/feed/queries";
import type {
  ChartShareImport,
  CreatePostRequest,
  PostFormat,
  PostRef,
} from "@/shared/api/feed/types";
import { ai } from "@/shared/lib/ai";
import { cn } from "@/shared/lib/tw";
import { button, itemButton } from "@/shared/ui/button";
import { LoadingText, Spinner } from "@/shared/ui/Loading";
import { OrderedSelect } from "@/shared/ui/OrderedSelect";
import {
  docText,
  isEmptyDoc,
  RichTextEditor,
} from "@/shared/ui/rich-editor/rich-text";
import { Select } from "@/shared/ui/Select";
import { segmented } from "@/shared/ui/segmented";
import {
  buildPayload,
  type FormatInputs,
  linkRows,
} from "@/views/feed-new-post/model/payload";
import "../config/messages";

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
  const { t } = useLingui();
  if (isPending)
    return (
      <div className="rounded-lg border border-line bg-elevated p-4">
        <LoadingText>
          <Trans>vis-a-lot 차트 공유를 불러오는 중</Trans>
        </LoadingText>
      </div>
    );
  if (error || !share) {
    const reason = error?.message ?? t`없는 공유`;
    const shareFailedDetail = t`${shareId}: ${reason}. 공유가 지워졌거나 다른 브라우저에서 만든 공유일 수 있습니다. 차트 없이 게시물을 쓸 수 있습니다.`;
    return (
      <div
        role="alert"
        className="flex flex-col gap-1 rounded-lg border border-danger/40 bg-danger/12 p-4 text-ui text-danger"
      >
        <strong>
          <Trans>차트 공유를 가져오지 못했습니다</Trans>
        </strong>
        <span className="text-xs">{shareFailedDetail}</span>
      </div>
    );
  }
  const chartTitle = share.title;
  const chartAlt = t`${chartTitle} 차트`;
  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-accent-line bg-accent-soft p-3">
      <img
        src={share.thumbnail}
        alt={chartAlt}
        className="block size-auto max-h-80 max-w-full rounded-md bg-elevated object-contain"
      />
      <figcaption className="text-xs text-fg-secondary">
        {t`vis-a-lot 공유에서 가져옴`} · {share.createdByName} ·{" "}
        {share.payload.chartType} · {share.payload.dataset}
        {share.payload.item.key !== "all" && ` · ${share.payload.item.label}`}
      </figcaption>
    </figure>
  );
}

export function NewPostView() {
  const { t } = useLingui();
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
  const chartLinkName = t`vis-a-lot 차트`;
  useEffect(() => {
    const s = share.data;
    if (!s || filled.current) return;
    filled.current = true;
    setFormat("chart");
    setTitle((prev) => prev || s.title);
    setLinks((l) =>
      l.some((x) => x.url === s.payload.link)
        ? l
        : [{ name: chartLinkName, url: s.payload.link }, ...l],
    );
  }, [share.data, chartLinkName]);

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

  /** AI가 채운 필드 이름(1~3개)으로 알림 문장을 만든다 */
  const aiFilled = (names: string[]) => {
    const [a, b, c] = names;
    const list =
      names.length === 1
        ? a
        : names.length === 2
          ? t({ message: `${a}·${b}`, comment: "필드 이름 둘을 잇는다" })
          : t({ message: `${a}·${b}·${c}`, comment: "필드 이름 셋을 잇는다" });
    // 조사(을/를)는 받침으로 고른다. 영어 번역은 쓰지 않는다.
    const josa = batchim(list);
    return names.length === 1
      ? t({
          message: `AI가 ${list}${select(josa, { none: "를", other: "을" })} 채웠습니다. 바꿔도 됩니다.`,
          context: "one field filled",
        })
      : t({
          message: `AI가 ${list}${select(josa, { none: "를", other: "을" })} 채웠습니다. 바꿔도 됩니다.`,
          context: "several fields filled",
        });
  };

  const suggest = async () => {
    if (!title.trim()) {
      setAiNote(t`제목을 먼저 적어 주세요.`);
      return;
    }
    setSuggesting(true);
    setAiNote(null);
    try {
      const s = await ai.suggestFields({
        title: title.trim(),
        body: docText(body),
        postTypes: (o.group?.postTypes ?? []).map((pt) => ({
          id: pt.id,
          name: pt.name,
        })),
        users: o.people.map((p) => ({ id: p.value, name: p.label })),
      });
      const next: Suggested = {};
      if (
        s.postTypeId &&
        o.group?.postTypes.some((pt) => pt.id === s.postTypeId)
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
        next.postTypeId &&
          t({
            message: "게시물 유형",
            context: "field name inside the AI suggestion sentence",
          }),
        next.priority &&
          t({
            message: "우선순위",
            context: "field name inside the AI suggestion sentence",
          }),
        next.assigneeId &&
          t({
            message: "담당자",
            context: "field name inside the AI suggestion sentence",
          }),
      ].filter((n): n is string => !!n);
      setAiNote(
        names.length ? aiFilled(names) : t`AI가 추천할 값을 찾지 못했습니다.`,
      );
    } catch (err) {
      const error = errorMessage(err);
      setAiNote(t`AI 추천에 실패했습니다: ${error}`);
    } finally {
      setSuggesting(false);
    }
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return setError(t`제목을 적어 주세요.`);
    if (!groupId) return setError(t`그룹을 골라 주세요.`);
    const { payload, thumbnail } = buildPayload(format, inputs, share.data);
    const orNull = (v: string) => (v === NONE ? null : v);
    const req: CreatePostRequest = {
      groupId,
      title: trimmed,
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
      const error = errorMessage(err);
      setError(t`만들지 못했습니다: ${error}`);
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-240 flex-col gap-5 p-4 md:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          <Trans>새 게시물</Trans>
        </h1>
        <button
          type="button"
          className={button({ size: "sm", class: "whitespace-nowrap" })}
          disabled={suggesting || !groupId}
          aria-busy={suggesting}
          title={t`제목·설명으로 게시물 유형·우선순위·담당자를 추천합니다`}
          onClick={suggest}
        >
          {suggesting ? (
            <Spinner size="sm" />
          ) : (
            <Sparkles size={13} aria-hidden="true" />
          )}
          <Trans>AI 추천</Trans>
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
            <legend className="mb-1 text-xs text-fg-secondary">
              <Trans>형식</Trans>
            </legend>
            <div className={seg.root()}>
              {(Object.keys(formatLabels()) as PostFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={seg.item()}
                  aria-pressed={format === f}
                  onClick={() => setFormat(f)}
                >
                  {formatLabels()[f]}
                </button>
              ))}
            </div>
          </fieldset>

          <Field label={t`제목 (필수)`} htmlFor={ids.title}>
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
            <span className={r.label()}>
              <Trans>설명</Trans>
            </span>
            <RichTextEditor initial={null} onChange={setBody} label={t`설명`} />
          </div>

          <FormatInputsFields
            format={format}
            inputs={inputs}
            onChange={setInputs}
            fromShare={!!share.data}
          />

          <Field
            label={t`체크리스트`}
            htmlFor={ids.checklist}
            hint={t`한 줄에 항목 하나`}
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
            <span className={r.label()}>
              <Trans>링크 첨부</Trans>
            </span>
            {links.map((l, i) => {
              const n = i + 1;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: 줄을 지우고 더하는 입력 목록이라 자리가 곧 정체다
                <div key={i} className="flex gap-1.5">
                  <input
                    className={field({ class: "w-40 flex-none" })}
                    value={l.name}
                    placeholder={t({
                      message: "이름",
                      context: "link name placeholder",
                    })}
                    aria-label={t`링크 ${n} 이름`}
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
                    aria-label={t`링크 ${n} 주소`}
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
                    aria-label={t`링크 ${n} 빼기`}
                    onClick={() =>
                      setLinks((ls) => ls.filter((_, j) => j !== i))
                    }
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              className={button({ size: "sm", class: "self-start" })}
              onClick={() => setLinks((ls) => [...ls, { name: "", url: "" }])}
            >
              <Plus size={13} aria-hidden="true" />
              <Trans>링크 더하기</Trans>
            </button>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-line bg-elevated p-3">
          <Select
            label={t({ message: "그룹", context: "group select label" })}
            value={groupId}
            placeholder={
              groups.isPending
                ? t({
                    message: "불러오는 중",
                    context: "loading groups placeholder",
                  })
                : t`그룹 없음`
            }
            options={groupList.map((g) => ({
              value: g.id,
              label: `${g.name} (${g.keyPrefix})`,
            }))}
            onChange={pickGroup}
          />
          <Select
            label={t`팀`}
            value={teamId}
            options={o.teams}
            onChange={setTeamId}
          />
          <Select
            label={t`게시물 유형`}
            aside={suggested.postTypeId && aiChip}
            value={postTypeId}
            options={o.postTypes}
            onChange={(v) => {
              setPostTypeId(v);
              setSuggested((s) => ({ ...s, postTypeId: undefined }));
            }}
          />
          <Select
            label={t`우선순위`}
            aside={suggested.priority && aiChip}
            value={priority}
            options={priorityOptions()}
            onChange={(v) => {
              setPriority(v);
              setSuggested((s) => ({ ...s, priority: undefined }));
            }}
          />
          <Select
            label={t`담당자`}
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
              label={t`요청자`}
              value={requesterId}
              options={o.peopleOrNone}
              onChange={setRequesterId}
            />
            {requesterId === NONE && (
              <p className="text-2xs text-fg-muted">
                <Trans>비어 있으면 작성자(나)가 요청자 역할을 합니다.</Trans>
              </p>
            )}
          </div>
          <OrderedSelect
            label={t`이해관계자`}
            options={o.people}
            value={stakeholderIds}
            placeholder={t({
              message: "없음",
              context: "no stakeholders placeholder",
            })}
            onChange={setStakeholderIds}
          />
          <Field label={t`기한`} htmlFor={ids.due}>
            <input
              id={ids.due}
              type="date"
              className={field()}
              value={dueDate}
              onChange={(e) => setDueDate(e.currentTarget.value)}
            />
          </Field>
          <div className={r.root()}>
            <span className={r.label()}>
              <Trans>태그</Trans>
            </span>
            <TagInput value={tags} onChange={setTags} />
          </div>
          <div className={r.root()}>
            <span className={r.label()}>
              <Trans>상위 이슈 (선택)</Trans>
            </span>
            {parent ? (
              <span className="flex min-h-7.5 items-center gap-2 rounded-md bg-panel px-2">
                <span className="text-xs font-semibold text-fg-secondary tabular-nums">
                  {parent.key}
                </span>
                <span className="min-w-0 flex-1 truncate">{parent.title}</span>
                <button
                  type="button"
                  className={itemButton()}
                  aria-label={t`상위 이슈 빼기`}
                  onClick={() => setParent(null)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ) : (
              <PostPicker
                label={t`상위 이슈`}
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
          <Trans context="cancel creating a post">취소</Trans>
        </button>
        <button
          type="submit"
          className={button({ variant: "primary" })}
          disabled={saving}
          aria-busy={saving}
        >
          {saving && <Spinner size="sm" tone="inherit" />}
          <Trans>게시물 만들기</Trans>
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
  const { t } = useLingui();
  const id = useId();
  switch (format) {
    case "chart":
      return fromShare ? null : (
        <p className="text-xs text-fg-muted">
          <Trans>
            차트 게시물은 vis-a-lot의 탭 도구 줄이나 공유 페이지에서 "피드에
            올리기"로 만들면 차트 이미지와 링크가 함께 들어옵니다.
          </Trans>
        </p>
      );
    case "image":
      return (
        <Field label={t`이미지 주소`} htmlFor={id} hint={t`썸네일로도 씁니다`}>
          <input
            id={id}
            className={field()}
            value={inputs.imageUrl}
            placeholder={t`https://… 또는 data:image/…`}
            onChange={(e) => set({ imageUrl: e.currentTarget.value })}
          />
        </Field>
      );
    case "video":
      return (
        <Field label={t`동영상 주소`} htmlFor={id}>
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
          <Field
            label={t({ message: "언어", context: "code language field label" })}
            htmlFor={`${id}-lang`}
          >
            <input
              id={`${id}-lang`}
              className={field({ class: "w-40" })}
              value={inputs.language}
              placeholder="sql, python …"
              onChange={(e) => set({ language: e.currentTarget.value })}
            />
          </Field>
          <Field
            label={t({ message: "코드", context: "code post field label" })}
            htmlFor={`${id}-code`}
          >
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
