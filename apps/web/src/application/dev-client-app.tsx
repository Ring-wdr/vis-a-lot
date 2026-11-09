"use client";

import { t } from "@lingui/core/macro";
import { useLocale } from "@vis-a-lot/shared/lib/i18n";
import dynamic from "next/dynamic";
import "./messages";

/** Providers(Lingui context) 밖에서 그리므로 전역 i18n으로 읽고 useLocale로 언어 변경을 구독한다. */
function Loading() {
  useLocale();
  return <p>{t`불러오는 중…`}</p>;
}

export const DevClientApp = dynamic(() => import("./dev-root"), {
  ssr: false,
  loading: () => <Loading />,
});
