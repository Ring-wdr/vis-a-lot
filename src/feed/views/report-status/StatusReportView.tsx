import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 현황 보고 (/feed/report/status) */
export function StatusReportView() {
  return (
    <FeedPlaceholder
      title="현황 보고"
      description="상단 숫자(상태별·기한 초과·담당자별 부하·검토 대기 체류)와 하단 목록."
    />
  );
}
