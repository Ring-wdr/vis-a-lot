"use client";

import { DELETED_DATASET_NAME, useDatasets } from "@/shared/api/queries";
import type { DatasetId, DatasetStatus } from "@/shared/api/types";
import { LoadingText } from "@/shared/ui/Loading";
import { Select } from "@/shared/ui/Select";
import { selectStyles } from "@/shared/ui/select-styles";

const STATE_SUFFIX: Record<DatasetStatus["state"], string> = {
  ready: "",
  generating: " · 등록 중",
  missing: " · 미등록",
  failed: " · 실패",
};

/**
 * 그릴 데이터 고르기. 샘플과 업로드한 데이터 중 등록한 것만 고를 수 있고, 샘플 등록은 상단 datastore, 파일은 upload 팝업에서 한다.
 * 컬럼은 데이터의 스키마에서 정해지므로, 등록하지 않은 데이터로는 그릴 수 없다.
 */
export function DatasetSelect({
  dataset,
  onChange,
}: {
  dataset: DatasetId;
  onChange: (dataset: DatasetId) => void;
}) {
  const datasets = useDatasets();
  const list = datasets.data?.datasets;
  const status = list?.find((d) => d.id === dataset);
  const options = (list ?? []).map((d) => ({
    value: d.id,
    // 목록을 받기 전에는 등록 여부를 모르니 상태를 붙이지 않는다.
    label: `${d.name}${STATE_SUFFIX[d.state]}`,
    disabled: d.state === "missing" || d.state === "failed",
  }));
  // 지운 데이터로 그린 탭도 고른 값이 보이도록 자리를 남긴다.
  if (list && !status) {
    options.push({
      value: dataset,
      label: DELETED_DATASET_NAME,
      disabled: true,
    });
  }

  return (
    <div className="flex flex-col gap-1 text-ui">
      <Select
        label="데이터"
        value={list ? dataset : null}
        placeholder={<LoadingText announce={false}>불러오는 중</LoadingText>}
        options={options}
        onChange={onChange}
        aside={
          <span className={selectStyles().aside()}>
            {datasets.isPending ? (
              <LoadingText>확인 중</LoadingText>
            ) : status?.state === "generating" ? (
              `등록 중 ${Math.floor((status.done / Math.max(1, status.total)) * 100)}%`
            ) : status?.state === "missing" ? (
              "미등록 · datastore에서 등록"
            ) : !status ? (
              "datastore에서 다른 데이터를 고르세요"
            ) : (
              ""
            )}
          </span>
        }
      />
    </div>
  );
}
