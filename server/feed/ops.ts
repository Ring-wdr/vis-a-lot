// 피드 op 목록. 모듈마다 defineOps로 만든 묶음을 여기서 합친다. 키는 '모듈.함수'.

import { groupsOps } from "./groups";
import { notificationsOps } from "./notifications";
import { postsOps } from "./posts";
import { schedulerOps } from "./scheduler";
import { seedOps } from "./seed";
import { systemOps } from "./system";
import { usersOps } from "./users";
import { viewsOps } from "./views";

export const FEED_OPS = {
  ...systemOps,
  ...usersOps,
  ...groupsOps,
  ...postsOps,
  ...notificationsOps,
  ...schedulerOps,
  ...seedOps,
  ...viewsOps,
};

export type FeedOps = typeof FEED_OPS;
export type FeedOpName = keyof FeedOps;
export type FeedArgs<K extends FeedOpName> = Parameters<FeedOps[K]>[1];
export type FeedResult<K extends FeedOpName> = Awaited<ReturnType<FeedOps[K]>>;
