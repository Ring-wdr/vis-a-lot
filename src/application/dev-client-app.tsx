"use client";

import dynamic from "next/dynamic";
import { defineMessages, useT } from "@/shared/lib/i18n";

const messages = defineMessages({
  ko: { loading: "불러오는 중…" },
  en: { loading: "Loading…" },
});

function Loading() {
  const text = useT(messages);
  return <p>{text.loading}</p>;
}

export const DevClientApp = dynamic(() => import("./dev-root"), {
  ssr: false,
  loading: () => <Loading />,
});
