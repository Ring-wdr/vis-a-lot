import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 보드 (/feed/board) */
export function BoardView() {
  return (
    <FeedPlaceholder
      title="보드"
      description="상태 열 칸반, 드래그로 상태 변경(검토 중 열로 옮기면 완료 요청), 팀 스윔레인."
    />
  );
}
