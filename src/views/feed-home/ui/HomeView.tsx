import { FeedPlaceholder } from "@/shared/ui/FeedPlaceholder";

/** 홈 피드 (/feed) */
export function HomeView() {
  return (
    <FeedPlaceholder
      title="홈 피드"
      description="그룹 탭별 카드 피드(썸네일·제목·상태·담당자·기한), 상단 내 작업 요약 띠(담당·승인 대기·기한 임박), 끌어올리기."
    />
  );
}
