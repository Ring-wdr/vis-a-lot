import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 알림 설정 (/feed/settings/notifications) */
export function NotificationSettingsView() {
  return (
    <FeedPlaceholder
      title="알림 설정"
      description="이벤트 × 채널(앱 내·슬랙·이메일) 매트릭스."
    />
  );
}
