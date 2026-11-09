import { Skeleton } from "./Loading";
import { settingsStyles } from "./settings-styles";

const s = settingsStyles();

/** legend 값 목록(● 값)을 받는 동안의 자리. 공통 색 설정과 item 설정 팝업이 같이 쓴다. */
export function LegendListSkeleton() {
  return (
    <ul className={s.legendList()} aria-busy="true">
      {([50, 30, 50] as const).map((width, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 받기 전 자리 표시용
        <li key={i} className={s.legendItem()}>
          <Skeleton className={s.legendSwatchSkeleton()} />
          <Skeleton width={width} />
        </li>
      ))}
    </ul>
  );
}
