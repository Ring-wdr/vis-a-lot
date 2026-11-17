import type { Metadata } from "next";
import { AnalyticsView } from "@/views/analytics/ui/AnalyticsView";

export const metadata: Metadata = {
  title: "analytics · vis-a-lot",
};

/**
 * 여러 칸에 데이터·차트를 따로 두고 함께 보는 화면. 로그인·차트 기본값·팝업·보드 상태는
 * `(session)` layout(ClientApp → SessionScope)이 맡아 `/`와 오가도 보드가 남는다.
 */
export default function AnalyticsPage() {
  return <AnalyticsView />;
}
