/* biome-ignore-all lint/performance/noImgElement: 서버가 그린 PNG를 그대로 띄운다. next/image 최적화 대상이 아니다. */

export type ChartImageData = { url: string; width: number; height: number };

/** 원본과 같은 형태: url이 있을 때만 이미지를 띄운다. */
export function ChartImage({
  data,
  alt,
}: {
  data: ChartImageData | undefined;
  alt: string;
}) {
  return (
    data?.url && (
      <img src={data.url} width={data.width} height={data.height} alt={alt} />
    )
  );
}
