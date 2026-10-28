"use client";

import { plural } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Database,
  History,
  LayoutGrid,
  type LucideIcon,
  Upload,
} from "lucide-react";
import { useTabsStore } from "@/entities/workspace/model/tabs-scope";
import {
  openDatastoreDialog,
  openUploadThenDatastore,
} from "@/features/register-dataset/ui/DatastoreDialog";
import { useDatasets, useHistoryList } from "@/shared/api/queries";
import { intlLocale } from "@/shared/lib/i18n";
import "../config/messages";

/** 받으면 건수를 적는다. 받는 동안에는 …로 둔다. */
const count = (n: number | undefined) =>
  n === undefined ? "…" : n.toLocaleString(intlLocale());

const card =
  "group flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-elevated p-4 text-left shadow-sm transition-colors duration-120 hover:border-accent focus-visible:border-accent";
const cardIcon =
  "grid size-9 flex-none place-items-center rounded-md bg-accent-soft text-accent";

function ActionCard({
  Icon,
  title,
  children,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={card} onClick={onClick}>
      <span className={cardIcon} aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold group-hover:text-accent">{title}</span>
        <span className="text-ui text-fg-secondary">{children}</span>
      </span>
    </button>
  );
}

/**
 * 처음 들어왔을 때의 시작 화면. 아직 연 차트가 없으므로 빈 grid 대신 할 수 있는 일을 고르게 한다.
 * gallery나 history를 고르면 작업 화면으로 바뀐다.
 */
export function HomeLanding() {
  const { t } = useLingui();
  const tabs = useTabsStore();
  const history = useHistoryList().data?.entries.length;
  const datasets = useDatasets().data?.datasets;
  const ready = datasets?.filter((d) => d.state === "ready").length;
  const setView = (view: "gallery" | "history") =>
    tabs.getState().setView(view);
  // 건수는 지금 언어로 적고, 받기 전(…)에는 복수형(영어 charts·datasets)을 쓴다.
  const historyCount = count(history);
  const historyN = history ?? 0;
  const readyCount = count(ready);
  const readyN = ready ?? 0;

  return (
    <main className="col-span-full row-[2/-1] flex min-h-0 justify-center overflow-y-auto bg-surface px-4 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">
            <Trans>무엇을 할까요?</Trans>
          </h1>
          <p className="text-sm text-fg-secondary">
            <Trans>
              브라우저 안의 서버가 데이터를 조회해 차트를 PNG로 그립니다. 새
              차트를 그리거나, 그렸던 차트를 다시 보거나, 데이터를 먼저 올려
              주세요.
            </Trans>
          </p>
        </header>
        <section className="grid gap-3 sm:grid-cols-2" aria-label={t`시작하기`}>
          <ActionCard
            Icon={LayoutGrid}
            title={t`새 차트 그리기`}
            onClick={() => setView("gallery")}
          >
            <Trans>gallery에서 데이터와 축을 고르고 draw합니다.</Trans>
          </ActionCard>
          <ActionCard
            Icon={History}
            title={t`기록 다시 보기`}
            onClick={() => setView("history")}
          >
            <span aria-busy={history === undefined || undefined}>
              {t({
                message: plural(historyN, {
                  other: `그렸던 차트 ${historyCount}건을 보기 전용으로 다시 엽니다.`,
                }),
                comment:
                  "{historyCount}는 언어에 맞춰 적은 건수(받는 중이면 …), historyN은 복수형을 고르는 수",
              })}
            </span>
          </ActionCard>
          <ActionCard
            Icon={Upload}
            title={t`데이터 올리기`}
            onClick={openUploadThenDatastore}
          >
            <Trans>CSV나 zip을 올려 새 데이터로 등록합니다.</Trans>
          </ActionCard>
          <ActionCard
            Icon={Database}
            title={t`데이터 관리`}
            onClick={() => openDatastoreDialog()}
          >
            <span aria-busy={ready === undefined || undefined}>
              {t({
                message: plural(readyN, {
                  other: `쓸 수 있는 데이터 ${readyCount}개를 살펴보고 고칩니다.`,
                }),
                comment:
                  "{readyCount}는 언어에 맞춰 적은 개수(받는 중이면 …), readyN은 복수형을 고르는 수",
              })}
            </span>
          </ActionCard>
        </section>
      </div>
    </main>
  );
}
