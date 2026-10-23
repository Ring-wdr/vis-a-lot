import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 새 게시물 (/feed/new) */
export function NewPostView() {
  return (
    <FeedPlaceholder
      title="새 게시물"
      description="형식·유형·우선순위·그룹·팀, 제목·설명, 요청자·담당자·이해관계자, 기한, 체크리스트, 첨부, AI 추천. ?share=로 차트 공유 가져오기."
    />
  );
}
