// 피드 DB 상태. 화면이 처음 뜰 때 비어 있는지 보고 시드를 넣는다.

import { defineOps } from "./context";

export const systemOps = defineOps({
  "system.status": async (ctx) => {
    const row = await ctx.db
      .selectFrom("users")
      .select((eb) => eb.fn.countAll<number>().as("users"))
      .executeTakeFirstOrThrow();
    const posts = await ctx.db
      .selectFrom("posts")
      .select((eb) => eb.fn.countAll<number>().as("posts"))
      .executeTakeFirstOrThrow();
    return { users: Number(row.users), posts: Number(posts.posts) };
  },
});
