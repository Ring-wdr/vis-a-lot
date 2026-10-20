// 메인 스레드 ↔ Worker 간 타입 안전 RPC.
// 실서버로 옮길 때는 이 계층만 프로세스 내 호출로 바꾸면 된다.

export type MethodMap = Record<
  string,
  { params: unknown; result: unknown; progress?: unknown }
>;

type ProgressOf<M extends MethodMap, K extends keyof M> = M[K] extends {
  progress: infer P;
}
  ? P
  : never;

type RpcCall = { id: number; method: string; params: unknown };
type RpcReply =
  | { id: number; kind: "result"; result: unknown }
  | { id: number; kind: "error"; error: string }
  | { id: number; kind: "progress"; progress: unknown };

const TRANSFER = Symbol("transfer");

/** tsconfig에 webworker lib을 넣지 않고 Worker 전역에서 쓰는 부분만 정의한다. */
export type WorkerScope = {
  readonly name: string;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (e: MessageEvent) => void): void;
};

type Transferred<T> = { [TRANSFER]: Transferable[]; value: T };

/** 결과 안의 ArrayBuffer 등을 복사 없이 넘기고 싶을 때 감싼다. */
export function transfer<T>(value: T, list: Transferable[]): Transferred<T> {
  return { [TRANSFER]: list, value };
}

function isTransferred(v: unknown): v is Transferred<unknown> {
  return typeof v === "object" && v !== null && TRANSFER in v;
}

export type CallOptions<P> = {
  transfer?: Transferable[];
  onProgress?: (progress: P) => void;
};

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (p: unknown) => void;
};

export class RpcClient<M extends MethodMap> {
  readonly #worker: Worker;
  readonly #pending = new Map<number, Pending>();
  #seq = 0;

  constructor(worker: Worker) {
    this.#worker = worker;
    worker.addEventListener("message", (e: MessageEvent<RpcReply>) => {
      const pending = this.#pending.get(e.data.id);
      if (!pending) return;
      if (e.data.kind === "progress") {
        pending.onProgress?.(e.data.progress);
        return;
      }
      this.#pending.delete(e.data.id);
      if (e.data.kind === "result") pending.resolve(e.data.result);
      else pending.reject(new Error(e.data.error));
    });
    worker.addEventListener("error", (e) => {
      const error = new Error(`worker error: ${e.message}`);
      for (const p of this.#pending.values()) p.reject(error);
      this.#pending.clear();
    });
  }

  call<K extends keyof M & string>(
    method: K,
    params: M[K]["params"],
    options: CallOptions<ProgressOf<M, K>> = {},
  ): Promise<M[K]["result"]> {
    const id = ++this.#seq;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        onProgress: options.onProgress as ((p: unknown) => void) | undefined,
      });
      this.#worker.postMessage(
        { id, method, params } satisfies RpcCall,
        options.transfer ?? [],
      );
    });
  }
}

export type RpcHandlers<M extends MethodMap> = {
  [K in keyof M]: (
    params: M[K]["params"],
    ctx: { progress: (p: ProgressOf<M, K>) => void },
  ) => Promise<M[K]["result"] | Transferred<M[K]["result"]>>;
};

/** Worker 쪽에서 호출 처리기를 등록한다. */
export function serveRpc<M extends MethodMap>(handlers: RpcHandlers<M>) {
  const scope = globalThis as unknown as WorkerScope;
  scope.addEventListener("message", async (e: MessageEvent<RpcCall>) => {
    const { id, method, params } = e.data;
    const progress = (p: unknown) =>
      scope.postMessage({
        id,
        kind: "progress",
        progress: p,
      } satisfies RpcReply);
    try {
      const handler = handlers[method as keyof M];
      if (!handler) throw new Error(`unknown method: ${method}`);
      const out = await handler(params as M[keyof M]["params"], { progress });
      if (isTransferred(out)) {
        scope.postMessage(
          { id, kind: "result", result: out.value } satisfies RpcReply,
          out[TRANSFER],
        );
      } else {
        scope.postMessage({
          id,
          kind: "result",
          result: out,
        } satisfies RpcReply);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      scope.postMessage({ id, kind: "error", error } satisfies RpcReply);
    }
  });
}
