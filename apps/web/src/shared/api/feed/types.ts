// 피드 API 타입. 모두 피드 서비스 OAS에서 생성한 컴포넌트 타입이다.

import type { components } from "@/shared/api/generated/feed";

type Feed = components["schemas"];

// system·seed·scheduler
export type FeedStatus = Feed["FeedStatus"];
export type FeedClock = Feed["FeedClock"];
export type FeedSnapshot = Feed["FeedSnapshot"];
export type SeedImportResponse = Feed["SeedImportResponse"];
export type SchedulerRunResponse = Feed["SchedulerRunResponse"];

// users
export type FeedUser = Feed["FeedUser"];
export type Me = Feed["Me"];
export type DeactivateResponse = Feed["DeactivateResponse"];

// groups
export type Group = Feed["Group"];
export type GroupDetail = Feed["GroupDetail"];
export type GroupRole = Feed["GroupRole"];
export type GroupMember = Feed["GroupMember"];
export type Team = Feed["Team"];
export type PostType = Feed["PostType"];
export type StatusNames = Feed["StatusNames"];
export type UpdateGroupRequest = Feed["UpdateGroupRequest"];
export type SavePostTypeRequest = Feed["SavePostTypeRequest"];
export type SaveTeamRequest = Feed["SaveTeamRequest"];

// posts
export type PostStatus = Feed["PostStatus"];
export type StatusCategory = Feed["StatusCategory"];
export type PostFormat = Feed["PostFormat"];
export type Priority = Feed["Priority"];
export type Day = Feed["Day"];
export type HoldReason = Feed["HoldReason"];
export type CancelReason = Feed["CancelReason"];
export type RelationKind = Feed["RelationKind"];
export type PostRef = Feed["PostRef"];
export type PostSummary = Feed["PostSummary"];
export type PostDetail = Feed["PostDetail"];
export type PostPermissions = Feed["PostPermissions"];
export type PostRelation = Feed["PostRelation"];
export type ChecklistItem = Feed["ChecklistItem"];
export type Attachment = Feed["Attachment"];
export type PostFilter = Feed["PostFilter"];
export type PostSortField = Feed["PostSortField"];
export type PostQueryRequest = Feed["PostQueryRequest"];
export type PostQueryResponse = Feed["PostQueryResponse"];
export type CreatePostRequest = Feed["CreatePostRequest"];
export type UpdatePostRequest = Feed["UpdatePostRequest"];
export type TransitionRequest = Feed["TransitionRequest"];
export type RelationRequest = Feed["RelationRequest"];
export type BulkUpdateRequest = Feed["BulkUpdateRequest"];
export type BulkUpdateResponse = Feed["BulkUpdateResponse"];
export type UpdateChecklistItemRequest = Feed["UpdateChecklistItemRequest"];
export type MyWorkSummary = Feed["MyWorkSummary"];
export type FeedEvent = Feed["FeedEvent"];

// notifications
export type NotifyKind = Feed["NotifyKind"];
export type Notification = Feed["Notification"];
export type InboxGroup = Feed["InboxGroup"];
export type InboxResponse = Feed["InboxResponse"];
export type NotificationSetting = Feed["NotificationSetting"];
export type OutboxMessage = Feed["OutboxMessage"];
export type OutboxChannel = OutboxMessage["channel"];

// views
export type SavedView = Feed["SavedView"];
export type SaveViewRequest = Feed["SaveViewRequest"];
export type ViewLayout = Feed["ViewLayout"];
export type ViewGroupBy = Feed["ViewGroupBy"];
export type ViewSort = Feed["ViewSort"];

// imports
export type ChartShareImport = Feed["ChartShareImport"];
