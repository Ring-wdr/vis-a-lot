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
import { saveBlob } from "@/shared/lib/save-file";
import { showAlert, showConfirm } from "@/shared/ui/AlertDialog";
import { button } from "@/shared/ui/button";
import { page } from "@/shared/ui/feed-styles";
import { LoadingText } from "@/shared/ui/Loading";

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
  const status = useFeedStatus();
  const reset = useResetFeed();
  const importSeed = useImportSeed();
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = reset.isPending || importSeed.isPending || exporting;

  const onReset = async () => {
    const ok = await showConfirm(
      "피드 데이터를 모두 지우고 기본 시나리오를 다시 적재할까요?",
      { confirmLabel: "리셋" },
    );
    if (!ok) return;
    reset.mutate(undefined, {
      onSuccess: (s) =>
        setResult(`리셋했습니다: 사용자 ${s.users}명, 게시물 ${s.posts}개`),
      onError: (err) => showAlert(`리셋하지 못했습니다: ${err.message}`),
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
      showAlert(`내보내지 못했습니다: ${errorText(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const onImport = async (file: File) => {
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(await file.text());
    } catch (err) {
      showAlert(`JSON을 읽지 못했습니다: ${errorText(err)}`);
      return;
    }
    if (!isSnapshot(snapshot)) {
      showAlert("피드 스냅숏 형식(schemaVersion, tables)이 아닙니다.");
      return;
    }
    const ok = await showConfirm(
      `지금 피드 데이터를 지우고 '${file.name}'으로 채울까요?`,
      { confirmLabel: "가져오기" },
    );
    if (!ok) return;
    importSeed.mutate(snapshot, {
      onSuccess: (r) => setResult(`가져왔습니다: ${r.rows}행`),
      onError: (err) => showAlert(`가져오지 못했습니다: ${err.message}`),
    });
  };

  return (
    <div className={p.root()}>
      <h1 className={p.title()}>시드</h1>
      <p className={p.lead()}>
        프로토타입 데이터를 처음 상태로 되돌리거나, JSON으로 저장해 두고 다시
        채웁니다.
      </p>

      <section className={p.section()}>
        <h2 className={p.sectionTitle()}>지금 데이터</h2>
        {status.isPending ? (
          <LoadingText>불러오는 중</LoadingText>
        ) : status.isError ? (
          <p role="alert" className="text-danger">
            상태를 불러오지 못했습니다: {status.error.message}
          </p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-fg-muted">사용자</dt>
            <dd>{status.data.users}명</dd>
            <dt className="text-fg-muted">게시물</dt>
            <dd>{status.data.posts}개</dd>
          </dl>
        )}
      </section>

      <section className={p.section()} aria-busy={busy}>
        <h2 className={p.sectionTitle()}>관리</h2>
        <div className={p.row()}>
          <button
            type="button"
            className={button({ variant: "danger", size: "sm" })}
            disabled={busy}
            onClick={onReset}
          >
            <RotateCcw size={14} aria-hidden="true" />
            리셋
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={busy}
            onClick={onExport}
          >
            <Download size={14} aria-hidden="true" />
            JSON 내보내기
          </button>
          <button
            type="button"
            className={button({ size: "sm" })}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            JSON 가져오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="가져올 JSON 파일"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (file) onImport(file);
            }}
          />
          {busy && <LoadingText>처리하는 중</LoadingText>}
        </div>
        <p className="text-xs text-fg-muted">
          리셋은 기본 시나리오(사용자 8명, 그룹 2개, 게시물 60개, 4주치
          이벤트)를 다시 적재합니다.
        </p>
        {result && <output className="text-fg-secondary">{result}</output>}
      </section>
    </div>
  );
}
