import { Skeleton } from "@/shared/ui/Loading";

/** 표 자리 잡기 */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-line bg-elevated p-3"
      aria-busy="true"
    >
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 자리 잡기 막대는 순서뿐이다
        <Skeleton key={i} width={i % 3 === 0 ? 70 : i % 3 === 1 ? 90 : 50} />
      ))}
    </div>
  );
}
