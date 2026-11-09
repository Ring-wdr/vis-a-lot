// 피드 groups API: 그룹 목록·하나, 설정, 멤버, 팀, 게시물 유형.

import { feedClient, unwrap } from "./client";
import type {
  GroupRole,
  SavePostTypeRequest,
  SaveTeamRequest,
  UpdateGroupRequest,
} from "./types";

const group = (groupId: string) => ({ params: { path: { groupId } } });

export const groupsApi = {
  list: () => unwrap(feedClient.GET("/groups")),
  get: (groupId: string) =>
    unwrap(feedClient.GET("/groups/{groupId}", group(groupId))),
  update: (groupId: string, body: UpdateGroupRequest) =>
    unwrap(feedClient.PATCH("/groups/{groupId}", { ...group(groupId), body })),
  setMember: (groupId: string, userId: string, role: GroupRole) =>
    unwrap(
      feedClient.PUT("/groups/{groupId}/members/{userId}", {
        params: { path: { groupId, userId } },
        body: { role },
      }),
    ),
  removeMember: (groupId: string, userId: string) =>
    unwrap(
      feedClient.DELETE("/groups/{groupId}/members/{userId}", {
        params: { path: { groupId, userId } },
      }),
    ),
  saveTeam: (groupId: string, body: SaveTeamRequest) =>
    unwrap(
      feedClient.POST("/groups/{groupId}/teams", { ...group(groupId), body }),
    ),
  deleteTeam: (groupId: string, teamId: string) =>
    unwrap(
      feedClient.DELETE("/groups/{groupId}/teams/{teamId}", {
        params: { path: { groupId, teamId } },
      }),
    ),
  savePostType: (groupId: string, body: SavePostTypeRequest) =>
    unwrap(
      feedClient.POST("/groups/{groupId}/post-types", {
        ...group(groupId),
        body,
      }),
    ),
  deletePostType: (groupId: string, postTypeId: string) =>
    unwrap(
      feedClient.DELETE("/groups/{groupId}/post-types/{postTypeId}", {
        params: { path: { groupId, postTypeId } },
      }),
    ),
};
