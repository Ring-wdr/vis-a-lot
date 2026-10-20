import type { RenderMethods } from "./protocol";
import { type CallOptions, RpcClient } from "./rpc";

type Task = {
  run: (client: RpcClient<RenderMethods>) => Promise<unknown>;
  onStart?: () => void;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

type ProgressOf<K extends keyof RenderMethods> = RenderMethods[K] extends {
  progress: infer P;
}
  ? P
  : never;

export type PoolCallOptions<K extends keyof RenderMethods> = CallOptions<
  ProgressOf<K>
> & {
  /** Worker가 이 작업을 집어 든 순간 */
  onStart?: () => void;
};

/** Render Worker N개에 작업을 FIFO로 나눠 준다. 순서를 바꾸는 우선순위는 두지 않는다. */
export class RenderPool {
  readonly size: number;
  readonly #idle: RpcClient<RenderMethods>[] = [];
  readonly #queue: Task[] = [];

  constructor(size: number) {
    this.size = size;
    for (let i = 0; i < size; i++) {
      const worker = new Worker(
        new URL("./workers/render.worker.ts", import.meta.url),
        { type: "module", name: `render-${i}` },
      );
      this.#idle.push(new RpcClient<RenderMethods>(worker));
    }
  }

  call<K extends keyof RenderMethods & string>(
    method: K,
    params: RenderMethods[K]["params"],
    { onStart, ...options }: PoolCallOptions<K> = {},
  ): Promise<RenderMethods[K]["result"]> {
    return new Promise((resolve, reject) => {
      this.#queue.push({
        run: (client) => client.call(method, params, options),
        onStart,
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.#drain();
    });
  }

  #drain() {
    while (this.#idle.length > 0 && this.#queue.length > 0) {
      const client = this.#idle.shift() as RpcClient<RenderMethods>;
      const task = this.#queue.shift() as Task;
      task.onStart?.();
      task
        .run(client)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.#idle.push(client);
          this.#drain();
        });
    }
  }
}

export function defaultPoolSize() {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 2;
  return Math.max(1, Math.min(4, cores - 1));
}
