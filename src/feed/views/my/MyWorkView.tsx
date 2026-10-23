import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 내 작업 (/feed/my) */
export function MyWorkView() {
  return (
    <FeedPlaceholder
      title="내 작업"
      description="담당 / 내가 요청 / 승인 대기 / 이해관계자 탭, 기한순 목록, 옆 패널."
    />
  );
}
