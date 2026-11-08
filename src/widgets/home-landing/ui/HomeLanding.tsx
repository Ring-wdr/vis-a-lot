"use client";

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
import { defineMessages, intlLocale, useT } from "@/shared/lib/i18n";

/** 받으면 건수를 적는다. 받는 동안에는 …로 둔다. */
const count = (n: number | undefined) =>
  n === undefined ? "…" : n.toLocaleString(intlLocale());

const messages = defineMessages({
  ko: {
    title: "무엇을 할까요?",
    intro:
      "브라우저 안의 서버가 데이터를 조회해 차트를 PNG로 그립니다. 새 차트를 그리거나, 그렸던 차트를 다시 보거나, 데이터를 먼저 올려 주세요.",
    start: "시작하기",
    draw: "새 차트 그리기",
    drawBody: "gallery에서 데이터와 축을 고르고 draw합니다.",
    history: "기록 다시 보기",
    historyBody: (n: number | undefined) =>
      `그렸던 차트 ${count(n)}건을 보기 전용으로 다시 엽니다.`,
    upload: "데이터 올리기",
    uploadBody: "CSV나 zip을 올려 새 데이터로 등록합니다.",
    manage: "데이터 관리",
    manageBody: (n: number | undefined) =>
      `쓸 수 있는 데이터 ${count(n)}개를 살펴보고 고칩니다.`,
  },
  en: {
    title: "What would you like to do?",
    intro:
      "A server inside your browser queries the data and draws charts as PNGs. Draw a new chart, revisit past ones, or upload data first.",
    start: "Get started",
    draw: "Draw a new chart",
    drawBody: "Pick data and axes in gallery, then draw.",
    history: "Revisit history",
    historyBody: (n: number | undefined) =>
      `Reopen ${count(n)} past ${n === 1 ? "chart" : "charts"} read-only.`,
    upload: "Upload data",
    uploadBody: "Upload a CSV or zip to register it as new data.",
    manage: "Manage data",
    manageBody: (n: number | undefined) =>
      `Review and edit ${count(n)} ready ${n === 1 ? "dataset" : "datasets"}.`,
  },
});

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
  const text = useT(messages);
  const tabs = useTabsStore();
  const history = useHistoryList().data?.entries.length;
  const datasets = useDatasets().data?.datasets;
  const ready = datasets?.filter((d) => d.state === "ready").length;
  const setView = (view: "gallery" | "history") =>
    tabs.getState().setView(view);

  return (
    <main className="col-span-full row-[2/-1] flex min-h-0 justify-center overflow-y-auto bg-surface px-4 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-bold">{text.title}</h1>
          <p className="text-sm text-fg-secondary">{text.intro}</p>
        </header>
        <section className="grid gap-3 sm:grid-cols-2" aria-label={text.start}>
          <ActionCard
            Icon={LayoutGrid}
            title={text.draw}
            onClick={() => setView("gallery")}
          >
            {text.drawBody}
          </ActionCard>
          <ActionCard
            Icon={History}
            title={text.history}
            onClick={() => setView("history")}
          >
            <span aria-busy={history === undefined || undefined}>
              {text.historyBody(history)}
            </span>
          </ActionCard>
          <ActionCard
            Icon={Upload}
            title={text.upload}
            onClick={openUploadThenDatastore}
          >
            {text.uploadBody}
          </ActionCard>
          <ActionCard
            Icon={Database}
            title={text.manage}
            onClick={() => openDatastoreDialog()}
          >
            <span aria-busy={ready === undefined || undefined}>
              {text.manageBody(ready)}
            </span>
          </ActionCard>
        </section>
      </div>
    </main>
  );
}
