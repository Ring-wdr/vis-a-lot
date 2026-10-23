"use client";

import { AlarmClock, CheckCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMySummary } from "@/feed/api/queries";
import { myWorkHref } from "../my/my-work";

function Stat({
  href,
  icon,
  label,
  hint,
  value,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  value: number | undefined;
}) {
  return (
    <li className="min-w-0">
      <Link
        href={href}
        className="flex min-w-0 items-center gap-2.5 rounded-lg border border-line bg-elevated px-3 py-2 text-fg no-underline hover:bg-panel-hover"
        title={hint ? `${label} (${hint})` : label}
      >
        <span
          className="hidden size-8 flex-none place-items-center rounded-md bg-accent-soft text-accent sm:grid"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-xs text-fg-secondary">{label}</span>
          <span className="text-xl font-bold tabular-nums">{value ?? "–"}</span>
        </span>
      </Link>
    </li>
  );
}

/** 홈 위 내 작업 요약 띠: 담당·승인 대기·기한 임박. 누르면 내 작업의 그 탭으로 */
export function MySummaryStrip() {
  const summary = useMySummary();
  const s = summary.data;
  return (
    <section aria-label="내 작업 요약" className="flex flex-col gap-1">
      <ul className="grid grid-cols-3 gap-2">
        <Stat
          href={myWorkHref({ tab: "assigned" })}
          icon={<UserCheck size={16} />}
          label="담당"
          value={s?.assigned}
        />
        <Stat
          href={myWorkHref({ tab: "review" })}
          icon={<CheckCheck size={16} />}
          label="승인 대기"
          value={s?.awaitingReview}
        />
        <Stat
          href={myWorkHref({ tab: "assigned", dueSoon: true })}
          icon={<AlarmClock size={16} />}
          label="기한 임박"
          hint="3일 안·지남"
          value={s?.dueSoon}
        />
      </ul>
      {summary.isError && (
        <p className="text-xs text-danger">
          요약을 불러오지 못했습니다 ({summary.error.message})
        </p>
      )}
    </section>
  );
}
