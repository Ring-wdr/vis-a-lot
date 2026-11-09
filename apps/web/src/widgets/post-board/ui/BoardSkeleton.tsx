import { BOARD_STATUSES } from "@/entities/post/model/post-model";
import { Skeleton } from "@/shared/ui/Loading";

/** 보드 자리 잡기: 상태 열 6개 */
export function BoardSkeleton() {
  return (
    <div className="overflow-x-auto" aria-busy="true">
      <div className="grid min-w-max grid-cols-[repeat(6,minmax(15rem,1fr))] gap-2">
        {BOARD_STATUSES.map((s) => (
          <div key={s} className="flex flex-col gap-2 rounded-lg bg-panel p-2">
            <Skeleton width={50} />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
