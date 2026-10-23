import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 게시물 상세 (/feed/post) */
export function PostView() {
  return (
    <FeedPlaceholder
      title="게시물 상세"
      description="본문, 필드 패널, 체크리스트, 관계, 댓글·활동 로그 타임라인, 완료 요청·승인·반려·보류·취소, 구독."
    />
  );
}
