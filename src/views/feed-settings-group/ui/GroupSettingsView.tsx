import { FeedPlaceholder } from "@/shared/ui/FeedPlaceholder";

/** 그룹 설정 (/feed/settings/group) */
export function GroupSettingsView() {
  return (
    <FeedPlaceholder
      title="그룹 설정"
      description="게시물 유형(이름·색), 상태 이름, 멤버·관리자, 이슈 키 접두사, 비공개 여부."
    />
  );
}
