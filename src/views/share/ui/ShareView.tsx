/* biome-ignore-all lint/performance/noImgElement: 공유에 고정해 둔 PNG를 그대로 띄운다. next/image 최적화 대상이 아니다. */
"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { ArrowLeft, LayoutGrid, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SHARE_PAGE, sharePageUrl } from "@/entities/chart/lib/share";
import { chartKindLabel } from "@/entities/chart/lib/title";
import { useTabsStore } from "@/entities/workspace/model/tabs-scope";
import { tabsLockedHint } from "@/entities/workspace/model/tabs-store";
import { UserMenu } from "@/features/auth/ui/UserMenu";
import { queueOpen } from "@/features/open-chart/model/pending-open";
import { FeedPostButton } from "@/features/share-chart/ui/FeedPostButton";
import { LocaleSelect } from "@/features/switch-locale/ui/LocaleSelect";
import { ThemeSelect } from "@/features/switch-theme/ui/ThemeSelect";
import { ApiRequestError } from "@/shared/api/api";
import {
  useDatasetNames,
  useDeleteShare,
  useShare,
  useShares,
} from "@/shared/api/queries";
import { useSession } from "@/shared/api/session";
import type { Share } from "@/shared/api/types";
import { localeCached } from "@/shared/lib/i18n";
import { tv } from "@/shared/lib/tw";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Loading";
import { navLink } from "@/shared/ui/nav";
import "../config/messages";

/** 제목 아래 한 줄 정보 (만든 사람·시각·데이터셋) */
const meta = tv({ base: "mt-1 text-ui text-fg-muted" });
const title = tv({ base: "text-xl font-bold" });
/** 불러오는 중·없음·오류 안내 */
const state = tv({
  base: "my-6 flex flex-col items-start gap-2 text-fg-secondary",
});

const dateTime = localeCached(
  (locale) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }),
);

/** 공유한 차트를 새 gallery 탭에 열고 작업 화면으로 간다. */
function useOpenInGallery() {
  const tabs = useTabsStore();
  const router = useRouter();
  return (share: Share) => {
    const tab = tabs.getState().openGallery(share.spec);
    if (!tab) {
      showAlert(tabsLockedHint());
      return;
    }
    queueOpen(tab.store, { spec: share.spec, restore: share.restore });
    router.push("/");
  };
}

function CopyLinkButton({ share }: { share: Share }) {
  const { t } = useLingui();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={button({ size: "sm" })}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(sharePageUrl(share.id));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          showAlert(t`링크를 복사하지 못했습니다: ${message}`);
        }
      }}
    >
      {copied ? <Trans>복사됨</Trans> : <Trans>링크 복사</Trans>}
    </button>
  );
}

/** 만든 사용자에게만 보인다. 지우면 내 공유 목록으로 간다. */
function DeleteButton({ share }: { share: Share }) {
  const { t } = useLingui();
  const userId = useSession((s) =>
    s.status === "authenticated" ? s.user.id : undefined,
  );
  const remove = useDeleteShare();
  const router = useRouter();
  if (userId !== share.createdBy) return null;
  return (
    <button
      type="button"
      className={button({ variant: "danger", size: "sm" })}
      disabled={remove.isPending}
      onClick={async () => {
        const title = share.title;
        const ok = await showConfirm(
          t`''${title}'' 공유를 지울까요? 이 링크는 더 열리지 않습니다.`,
          { confirmLabel: t({ message: "지우기", context: "delete share" }) },
        );
        if (!ok) return;
        remove.mutate(share.id, {
          onSuccess: () => router.replace(SHARE_PAGE),
          onError: (err) => showAlert(err.message),
        });
      }}
    >
      <Trans context="delete share">지우기</Trans>
    </button>
  );
}

function ShareDetail({ id }: { id: string }) {
  const { t } = useLingui();
  const share = useShare(id);
  const names = useDatasetNames();
  const openInGallery = useOpenInGallery();

  if (share.isPending)
    return (
      <p className={state()}>
        <Spinner size="sm" /> <Trans>공유를 불러오는 중</Trans>
      </p>
    );
  if (share.isError) {
    const missing =
      share.error instanceof ApiRequestError && share.error.status === 404;
    const message = share.error.message;
    return (
      <div className={state()}>
        <p>
          {missing
            ? t`없는 공유이거나 지워진 공유입니다.`
            : t`공유를 불러오지 못했습니다: ${message}`}
        </p>
        <Link href={SHARE_PAGE} className="text-accent">
          <Trans>내 공유 목록으로</Trans>
        </Link>
      </div>
    );
  }

  const data = share.data;
  return (
    <article>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={title()}>{data.title}</h1>
          <p className={meta()}>
            {data.createdByName} · {dateTime().format(data.createdAt)} ·{" "}
            {names(data.dataset)} · {chartKindLabel(data.spec)}
            {data.item.key !== "all" && ` · ${data.item.label}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button({ variant: "primary", size: "sm" })}
            onClick={() => openInGallery(data)}
          >
            <Trans>gallery에서 열기</Trans>
          </button>
          <CopyLinkButton share={data} />
          <FeedPostButton share={async () => data} />
          <DeleteButton share={data} />
        </div>
      </header>
      <figure className="mt-5 rounded-lg border border-line bg-elevated p-4">
        <img
          className="block h-auto max-w-full"
          src={data.image.url}
          width={data.image.width}
          height={data.image.height}
          alt={data.title}
        />
        <figcaption className={meta()}>
          <Trans>
            만든 시점의 스냅숏입니다. 확대·도형 같은 편집은 gallery에서 열어서
            합니다.
          </Trans>
        </figcaption>
      </figure>
    </article>
  );
}

function ShareList() {
  const shares = useShares();
  const names = useDatasetNames();
  const listError = shares.error?.message;

  return (
    <section>
      <h1 className={title()}>
        <Trans>내 공유</Trans>
      </h1>
      <p className={meta()}>
        <Trans>
          탭 도구 줄의 '링크 복사'나 '피드에 올리기'를 누르면 공유가 생깁니다.
        </Trans>
      </p>
      {shares.isPending && (
        <p className={state()}>
          <Spinner size="sm" /> <Trans>불러오는 중</Trans>
        </p>
      )}
      {shares.isError && (
        <p className="mt-4 text-ui text-danger">
          <Trans>목록을 불러오지 못했습니다: {listError}</Trans>
        </p>
      )}
      {shares.data?.shares.length === 0 && (
        <p className={state()}>
          <Trans>아직 만든 공유가 없습니다.</Trans>
        </p>
      )}
      <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
        {shares.data?.shares.map((share) => (
          <li key={share.id}>
            <Link
              href={`${SHARE_PAGE}?id=${encodeURIComponent(share.id)}`}
              className="flex h-full flex-col gap-0.5 rounded-lg border border-line bg-elevated p-3 hover:border-accent-line"
            >
              <img
                className="mb-2 aspect-16/10 w-full bg-surface object-contain"
                src={share.image.url}
                alt=""
                loading="lazy"
              />
              <span className="text-sm font-semibold">{share.title}</span>
              <span className={meta()}>
                {dateTime().format(share.createdAt)} · {names(share.dataset)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 공유 페이지. `?id=`가 있으면 그 공유를, 없으면 내 공유 목록을 보여준다.
 * 같은 도메인이라 공유는 이 브라우저의 chart 서비스(PGlite)에서 읽는다.
 */
export function ShareView() {
  const { t } = useLingui();
  const id = useSearchParams().get("id") ?? "";
  return (
    <div className="grid min-h-screen grid-rows-[3rem_minmax(0,1fr)] bg-surface text-fg">
      <header className="flex items-center gap-6 border-b border-line px-4">
        <Link href="/" className="w-57 text-base font-bold">
          vis-a-lot
        </Link>
        <nav
          className="flex items-center gap-1"
          aria-label={t({ message: "화면", context: "app header nav" })}
        >
          <Link href="/" className={navLink()}>
            <LayoutGrid size={14} aria-hidden="true" />
            <Trans>작업 화면</Trans>
          </Link>
          <Link
            href={SHARE_PAGE}
            className={navLink()}
            aria-current={id ? undefined : "page"}
          >
            <Share2 size={14} aria-hidden="true" />
            <Trans>내 공유</Trans>
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <UserMenu>
            <ThemeSelect />
            <LocaleSelect />
          </UserMenu>
        </div>
      </header>
      <main className="mx-auto w-[min(70rem,100%)] px-4 pt-6 pb-12">
        {id && (
          <Link
            href={SHARE_PAGE}
            className="mb-3 inline-flex items-center gap-1 text-ui text-fg-secondary"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <Trans>내 공유</Trans>
          </Link>
        )}
        {id ? <ShareDetail id={id} /> : <ShareList />}
      </main>
    </div>
  );
}
