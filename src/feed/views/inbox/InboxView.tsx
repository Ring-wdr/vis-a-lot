import { FeedPlaceholder } from "../placeholder/FeedPlaceholder";

/** 알림함 (/feed/inbox) */
export function InboxView() {
  return (
    <FeedPlaceholder
      title="알림함"
      description="이슈별로 묶은 알림, 읽음/안읽음, 보관."
    />
  );
}
