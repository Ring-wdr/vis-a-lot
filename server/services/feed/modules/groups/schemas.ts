// 피드 groups API 스키마: 그룹, 멤버, 팀, 게시물 유형, 상태 이름.

import { z } from "@hono/zod-openapi";
import { GroupRoleSchema, PostStatusSchema } from "../common";

export const TeamSchema = z
  .object({ id: z.string(), name: z.string() })
  .openapi("Team");

export const PostTypeSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    /** '#rrggbb' */
    color: z.string().nullable(),
    sort: z.number().int(),
  })
  .openapi("PostType");

export const StatusNamesSchema = z
  .partialRecord(PostStatusSchema, z.string().min(1).max(20))
  .openapi("StatusNames");

export const GroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    keyPrefix: z.string(),
    description: z.string().nullable(),
    isPrivate: z.boolean(),
    /** 그룹별 상태 이름. 없는 상태는 기본 이름 */
    statusNames: StatusNamesSchema,
    /** 지금 사용자의 역할. 멤버가 아니면 null (시스템 관리자는 'admin'으로 본다) */
    myRole: GroupRoleSchema.nullable(),
    memberCount: z.number().int(),
  })
  .openapi("Group");

export const GroupMemberSchema = z
  .object({ userId: z.string(), role: GroupRoleSchema })
  .openapi("GroupMember");

export const GroupDetailSchema = GroupSchema.extend({
  members: z.array(GroupMemberSchema),
  teams: z.array(TeamSchema),
  postTypes: z.array(PostTypeSchema),
}).openapi("GroupDetail");

export const GroupListResponseSchema = z
  .object({ groups: z.array(GroupSchema) })
  .openapi("GroupListResponse");

export const UpdateGroupRequestSchema = z
  .object({
    name: z.string().min(1).max(60),
    description: z.string().max(500).nullable(),
    isPrivate: z.boolean(),
    /** 대문자 2~6자. 바꿔도 기존 게시물의 키는 그대로다 */
    keyPrefix: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/),
    statusNames: StatusNamesSchema,
  })
  .partial()
  .openapi("UpdateGroupRequest");

export const SetMemberRequestSchema = z
  .object({ role: GroupRoleSchema })
  .openapi("SetMemberRequest");

export const SaveTeamRequestSchema = z
  .object({ id: z.string().optional(), name: z.string().min(1).max(40) })
  .openapi("SaveTeamRequest");

export const SavePostTypeRequestSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1).max(30),
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .nullable(),
    sort: z.number().int().optional(),
  })
  .openapi("SavePostTypeRequest");

export type Group = z.infer<typeof GroupSchema>;
export type GroupDetail = z.infer<typeof GroupDetailSchema>;
export type UpdateGroupRequest = z.infer<typeof UpdateGroupRequestSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type PostType = z.infer<typeof PostTypeSchema>;
