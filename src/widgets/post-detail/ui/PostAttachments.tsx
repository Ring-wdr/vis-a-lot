"use client";

// 첨부: 파일·링크 목록. 게시물을 고칠 수 있으면 링크(이름 + URL)·파일(2MB까지, data URL)을 더하고 뺀다.

import { FileText, Link2, Paperclip, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { usePostAction } from "@/entities/post/model/use-post-action";
import { detail, field } from "@/entities/post/ui/styles";
import { commentsApi } from "@/shared/api/feed/comments";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { showAlert } from "@/shared/ui/AlertDialog";
import { button, itemButton } from "@/shared/ui/button";
import type { PostDetail } from "@/widgets/post-detail/model/detail-type";

const messages = defineMessages({
  ko: {
    tooLarge: (name: string, mb: string) =>
      `${name}은(는) ${mb}MB라 올릴 수 없습니다. 2MB 이하 파일만 첨부할 수 있어요.`,
    fileFailed: "파일을 첨부하지 못했습니다",
    title: "첨부",
    link: "링크",
    file: "파일",
    fileInput: "첨부할 파일",
    remove: (name: string) => `${name} 첨부 빼기`,
    removeFailed: "첨부를 빼지 못했습니다",
    linkFailed: "링크를 첨부하지 못했습니다",
    namePlaceholder: "이름 (비우면 URL)",
    linkName: "링크 이름",
    linkUrl: "링크 URL",
    add: "더하기",
    hint: "링크나 2MB 이하 파일을 첨부할 수 있습니다.",
  },
  en: {
    tooLarge: (name: string, mb: string) =>
      `${name} is ${mb}MB and can't be uploaded. Files must be 2MB or smaller.`,
    fileFailed: "Couldn't attach the file",
    title: "Attachments",
    link: "Link",
    file: "File",
    fileInput: "File to attach",
    remove: (name: string) => `Remove attachment ${name}`,
    removeFailed: "Couldn't remove the attachment",
    linkFailed: "Couldn't attach the link",
    namePlaceholder: "Name (defaults to URL)",
    linkName: "Link name",
    linkUrl: "Link URL",
    add: "Add",
    hint: "Attach links or files up to 2MB.",
  },
});

const d = detail();

/** 파일 첨부 한도 (브라우저 안 DB에 data URL로 두므로 작게) */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** "https://"가 없으면 붙인다 */
export function normalizeUrl(raw: string) {
  const url = raw.trim();
  if (!url) return "";
  return /^[a-z][a-z\d+.-]*:/i.test(url) ? url : `https://${url}`;
}

export function PostAttachments({ post }: { post: PostDetail }) {
  const text = useT(messages);
  const { run, pending } = usePostAction();
  const editable = post.permissions.edit;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!editable && post.attachments.length === 0) return null;

  const addFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      showAlert(text.tooLarge(file.name, (file.size / 1024 / 1024).toFixed(1)));
      return;
    }
    // 파일을 읽지 못한 것도 첨부 실패로 알린다.
    await run("file", text.fileFailed, async () =>
      commentsApi.addAttachment(post.id, {
        kind: "file",
        name: file.name,
        url: await readAsDataUrl(file),
      }),
    );
  };

  return (
    <section className={d.section()} aria-labelledby="post-attachments-title">
      <div className={d.sectionHead()}>
        <h2 id="post-attachments-title" className={d.sectionTitle()}>
          {text.title}{" "}
          <span className="font-normal text-fg-muted">
            {post.attachments.length}
          </span>
        </h2>
        {editable && (
          <span className="flex gap-1.5">
            <button
              type="button"
              className={button({ size: "sm" })}
              aria-expanded={adding}
              onClick={() => setAdding((v) => !v)}
            >
              <Link2 size={13} aria-hidden="true" />
              {text.link}
            </button>
            <button
              type="button"
              className={button({ size: "sm" })}
              disabled={!!pending}
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={13} aria-hidden="true" />
              {text.file}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              aria-label={text.fileInput}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) void addFile(file);
              }}
            />
          </span>
        )}
      </div>
      {post.attachments.length > 0 && (
        <ul className={d.list()}>
          {post.attachments.map((a) => {
            const Icon = a.kind === "link" ? Link2 : FileText;
            return (
              <li
                key={a.id}
                className="group/att flex min-h-7.5 min-w-0 items-center gap-1 rounded-md hover:bg-panel"
              >
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={a.kind === "file" ? a.name : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 px-1.5 text-accent"
                >
                  <Icon size={14} className="flex-none" aria-hidden="true" />
                  <span className="min-w-0 truncate">{a.name}</span>
                  {a.kind === "link" && (
                    <span className="ml-auto min-w-0 truncate text-2xs text-fg-muted">
                      {a.url}
                    </span>
                  )}
                </a>
                {editable && (
                  <button
                    type="button"
                    className={itemButton({ class: "mr-1 flex-none" })}
                    aria-label={text.remove(a.name)}
                    disabled={!!pending}
                    onClick={() =>
                      run("remove", text.removeFailed, () =>
                        commentsApi.removeAttachment(post.id, a.id),
                      )
                    }
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editable && adding && (
        <form
          className="flex flex-wrap gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const href = normalizeUrl(url);
            if (!href) return;
            if (
              await run("link", text.linkFailed, () =>
                commentsApi.addAttachment(post.id, {
                  kind: "link",
                  name: name.trim() || href,
                  url: href,
                }),
              )
            ) {
              setName("");
              setUrl("");
              setAdding(false);
            }
          }}
        >
          <input
            className={field({ class: "min-w-32 flex-1" })}
            value={name}
            maxLength={200}
            placeholder={text.namePlaceholder}
            aria-label={text.linkName}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <input
            className={field({ class: "min-w-48 flex-2" })}
            value={url}
            placeholder="https://"
            aria-label={text.linkUrl}
            inputMode="url"
            onChange={(e) => setUrl(e.currentTarget.value)}
          />
          <button
            type="submit"
            className={button({ size: "sm", class: "flex-none" })}
            disabled={!url.trim() || !!pending}
          >
            <Plus size={13} aria-hidden="true" />
            {text.add}
          </button>
        </form>
      )}
      {editable && post.attachments.length === 0 && !adding && (
        <p className={d.hint()}>{text.hint}</p>
      )}
    </section>
  );
}
