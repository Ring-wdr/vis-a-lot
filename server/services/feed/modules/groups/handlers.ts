// 피드 groups API handler. {groupId}는 id나 키 접두사 그대로 op에 넘긴다.

import type { FeedApp } from "../../app-type";
import { feedCall } from "../../call";
import * as routes from "./routes";

export function registerGroups(app: FeedApp) {
  return app
    .openapi(routes.listGroups, async (c) =>
      c.json(await feedCall(c, "groups.list", undefined), 200),
    )
    .openapi(routes.getGroup, async (c) =>
      c.json(await feedCall(c, "groups.get", c.req.valid("param")), 200),
    )
    .openapi(routes.updateGroup, async (c) => {
      const { groupId } = c.req.valid("param");
      const patch = c.req.valid("json");
      return c.json(
        await feedCall(c, "groups.update", { groupId, patch }),
        200,
      );
    })
    .openapi(routes.setGroupMember, async (c) => {
      const { groupId, userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      return c.json(
        await feedCall(c, "groups.setMember", { groupId, userId, role }),
        200,
      );
    })
    .openapi(routes.removeGroupMember, async (c) =>
      c.json(
        await feedCall(c, "groups.removeMember", c.req.valid("param")),
        200,
      ),
    )
    .openapi(routes.saveGroupTeam, async (c) => {
      const { groupId } = c.req.valid("param");
      const body = c.req.valid("json");
      return c.json(
        await feedCall(c, "groups.saveTeam", { groupId, ...body }),
        200,
      );
    })
    .openapi(routes.deleteGroupTeam, async (c) =>
      c.json(await feedCall(c, "groups.deleteTeam", c.req.valid("param")), 200),
    )
    .openapi(routes.saveGroupPostType, async (c) => {
      const { groupId } = c.req.valid("param");
      const body = c.req.valid("json");
      return c.json(
        await feedCall(c, "groups.savePostType", { groupId, ...body }),
        200,
      );
    })
    .openapi(routes.deleteGroupPostType, async (c) =>
      c.json(
        await feedCall(c, "groups.deletePostType", c.req.valid("param")),
        200,
      ),
    );
}
