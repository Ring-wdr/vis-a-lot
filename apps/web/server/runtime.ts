import type { DbMethods } from "./protocol";
import { defaultPoolSize, RenderPool } from "./render-pool";
import { RpcClient } from "./rpc";

/** 브라우저 안의 "서버" 프로세스. MSW handler가 처음 호출될 때 한 번만 띄운다. */
export type ServerRuntime = {
  db: RpcClient<DbMethods>;
  render: RenderPool;
};

let runtime: ServerRuntime | undefined;

export function getRuntime(): ServerRuntime {
  runtime ??= {
    db: new RpcClient<DbMethods>(
      new Worker(new URL("./workers/db.worker.ts", import.meta.url), {
        type: "module",
        name: "db",
      }),
    ),
    render: new RenderPool(defaultPoolSize()),
  };
  return runtime;
}
