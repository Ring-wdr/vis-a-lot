"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  useFeedStatus,
  useImportSeed,
  useResetFeed,
} from "@/shared/api/feed/queries";
import { seedApi } from "@/shared/api/feed/seed";
import type { FeedSnapshot } from "@/shared/api/feed/types";
import { defineMessages, useT } from "@/shared/lib/i18n";
import { saveBlob } from "@/shared/lib/save-file";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { page } from "@/shared/ui/feed-styles";
import { LoadingText } from "@/shared/ui/Loading";

const messages = defineMessages({
  ko: {
    resetConfirm: "피드 데이터를 모두 지우고 기본 시나리오를 다시 적재할까요?",
    reset: "리셋",
    resetDone: (users: number, posts: number) =>
      `리셋했습니다: 사용자 ${users}명, 게시물 ${posts}개`,
    resetFailed: (error: string) => `리셋하지 못했습니다: ${error}`,
    exportFailed: (error: string) => `내보내지 못했습니다: ${error}`,
    parseFailed: (error: string) => `JSON을 읽지 못했습니다: ${error}`,
    notSnapshot: "피드 스냅숏 형식(schemaVersion, tables)이 아닙니다.",
    importConfirm: (file: string) =>
      `지금 피드 데이터를 지우고 '${file}'으로 채울까요?`,
    import: "가져오기",
    importDone: (rows: number) => `가져왔습니다: ${rows}행`,
    importFailed: (error: string) => `가져오지 못했습니다: ${error}`,
    title: "시드",
    lead: "프로토타입 데이터를 처음 상태로 되돌리거나, JSON으로 저장해 두고 다시 채웁니다.",
    current: "지금 데이터",
    loading: "불러오는 중",
    statusFailed: (error: string) => `상태를 불러오지 못했습니다: ${error}`,
    users: "사용자",
    usersCount: (n: number) => `${n}명`,
    posts: "게시물",
    postsCount: (n: number) => `${n}개`,
    manage: "관리",
    exportJson: "JSON 내보내기",
    importJson: "JSON 가져오기",
    importFile: "가져올 JSON 파일",
    working: "처리하는 중",
    resetHint:
      "리셋은 기본 시나리오(사용자 8명, 그룹 2개, 게시물 60개, 4주치 이벤트)를 다시 적재합니다.",
  },
  en: {
    resetConfirm: "Erase all feed data and reload the default scenario?",
    reset: "Reset",
    resetDone: (users: number, posts: number) =>
      `Reset: ${users} ${users === 1 ? "user" : "users"}, ${posts} ${posts === 1 ? "post" : "posts"}`,
    resetFailed: (error: string) => `Couldn't reset: ${error}`,
    exportFailed: (error: string) => `Couldn't export: ${error}`,
    parseFailed: (error: string) => `Couldn't read the JSON: ${error}`,
    notSnapshot: "Not a feed snapshot (schemaVersion, tables).",
    importConfirm: (file: string) =>
      `Erase current feed data and fill it from '${file}'?`,
    import: "Import",
    importDone: (rows: number) =>
      `Imported: ${rows} ${rows === 1 ? "row" : "rows"}`,
    importFailed: (error: string) => `Couldn't import: ${error}`,
    title: "Seed",
    lead: "Restore the prototype data to its initial state, or save it as JSON and load it back.",
    current: "Current data",
    loading: "Loading",
    statusFailed: (error: string) => `Couldn't load status: ${error}`,
    users: "Users",
    usersCount: (n: number) => `${n}`,
    posts: "Posts",
    postsCount: (n: number) => `${n}`,
    manage: "Manage",
    exportJson: "Export JSON",
    importJson: "Import JSON",
    importFile: "JSON file to import",
    working: "Working",
    resetHint:
      "Reset reloads the default scenario (8 users, 2 groups, 60 posts, 4 weeks of events).",
  },
});

type Result =
  | { kind: "reset"; users: number; posts: number }
  | { kind: "import"; rows: number };

const p = page();

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

/** 파일 이름에 넣을 날짜·시각 (20261023-0845) */
const stamp = (d = new Date()) =>
  d.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");

function isSnapshot(v: unknown): v is FeedSnapshot {
  return (
    !!v &&
    typeof v === "object" &&
    "schemaVersion" in v &&
    "tables" in v &&
    typeof v.tables === "object"
  );
}

/** /feed/dev/seed: 리셋(기본 시나리오 다시 적재), JSON 내보내기·가져오기, 지금 데이터 수 */
export function SeedView() {
  const text = useT(messages);
  const status = useFeedStatus();
  const reset = useResetFeed();
  const importSeed = useImportSeed();
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = reset.isPending || importSeed.isPending || exporting;

  const onReset = async () => {
    const ok = await showConfirm(text.resetConfirm, {
      confirmLabel: text.reset,
    });
    if (!ok) return;
    reset.mutate(undefined, {
      onSuccess: (s) =>
        setResult({ kind: "reset", users: s.users, posts: s.posts }),
      onError: (err) => showAlert(text.resetFailed(err.message)),
    });
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const snapshot = await seedApi.export();
      saveBlob(
        new Blob([JSON.stringify(snapshot, null, 2)], {
          type: "application/json",
        }),
        `feed-seed-${stamp()}.json`,
      );
    } catch (err) {
      showAlert(text.exportFailed(errorText(err)));
    } finally {
      setExporting(false);
    }
  };

  const onImport = async (file: File) => {
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(await file.text());
    } catch (err) {
      showAlert(text.parseFailed(errorText(err)));
      return;
    }
    if (!isSnapshot(snapshot)) {
      showAlert(text.notSnapshot);
      return;
    }
    const ok = await showConfirm(text.importConfirm(file.name), {
      confirmLabel: text.import,
    });
    if (!ok) return;
    importSeed.mutate(snapshot, {
      onSuccess: (r) => setResult({ kind: "import", rows: r.rows }),
      onError: (err) => showAlert(text.importFailed(err.message)),
    });
  };

  return (
    <div className={p.root()}>
      <h1 className={p.title()}>{text.title}</h1>
      <p className={p.lead()}>{text.lead}</p>

      <section className={p.section()}>
        <h2 className={p.sectionTitle()}>{text.current}</h2>
        {status.isPending ? (
          <LoadingText>{text.loading}</LoadingText>
        ) : status.isError ? (
          <p role="alert" className="text-danger">
            {text.statusFailed(status.error.message)}
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-fg-muted">{text.users}</dt>
            <dd>{text.usersCount(status.data.users)}</dd>
            <dt className="text-fg-muted">{text.posts}</dt>
            <dd>{text.postsCount(status.data.posts)}</dd>
          </dl>
        )}
      </section>

      <section className={p.section()} aria-busy={busy}>
        <h2 className={p.sectionTitle()}>{text.manage}</h2>
        <div className={p.row()}>
          <button
            type="button"
            className={button({ variant: "danger", size: "sm" })}
            disabled={busy}
            onClick={onReset}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {text.reset}
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={busy}
            onClick={onExport}
          >
            <Download size={14} aria-hidden="true" />
            {text.exportJson}
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            {text.importJson}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label={text.importFile}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) void onImport(file);
            }}
          />
          {busy && <LoadingText>{text.working}</LoadingText>}
        </div>
        <p className="text-xs text-fg-muted">{text.resetHint}</p>
        {result && (
          <output className="text-fg-secondary">
            {result.kind === "reset"
              ? text.resetDone(result.users, result.posts)
              : text.importDone(result.rows)}
          </output>
        )}
      </section>
    </div>
  );
}
