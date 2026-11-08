"use client";

import { Trans, useLingui } from "@lingui/react/macro";
import { deletedDatasetName, useDatasets } from "@/shared/api/queries";
import type { DatasetId, DatasetStatus } from "@/shared/api/types";
import { LoadingText } from "@/shared/ui/Loading";
import { Select } from "@/shared/ui/Select";
import { selectStyles } from "@/shared/ui/select-styles";
import "../config/messages";

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
  const { t } = useLingui();
  /** 목록의 이름. 등록하지 않았거나 등록 중이면 상태를 붙인다. */
  const optionLabel = (name: string, state: DatasetStatus["state"]) => {
    switch (state) {
      case "ready":
        return name;
      case "generating":
        return t({
          message: `${name} · 등록 중`,
          comment: "name: 데이터 이름",
        });
      case "missing":
        return t({ message: `${name} · 미등록`, comment: "name: 데이터 이름" });
      case "failed":
        return t({ message: `${name} · 실패`, comment: "name: 데이터 이름" });
    }
  };
  const datasets = useDatasets();
  const list = datasets.data?.datasets;
  const status = list?.find((d) => d.id === dataset);
  const options = (list ?? []).map((d) => ({
    value: d.id,
    // 목록을 받기 전에는 등록 여부를 모르니 상태를 붙이지 않는다.
    label: optionLabel(d.name, d.state),
    disabled: d.state === "missing" || d.state === "failed",
  }));
  const registering = (s: { done: number; total: number }) => {
    const percent = Math.floor((s.done / Math.max(1, s.total)) * 100);
    return t`등록 중 ${percent}%`;
  };
  // 지운 데이터로 그린 탭도 고른 값이 보이도록 자리를 남긴다.
  if (list && !status) {
    options.push({
      value: dataset,
      label: deletedDatasetName(),
      disabled: true,
    });
  }

  return (
    <div className="flex flex-col gap-1 text-ui">
      <Select
        label={t({ message: "데이터", context: "dataset select" })}
        value={list ? dataset : null}
        placeholder={
          <LoadingText announce={false}>
            <Trans context="dataset select">불러오는 중</Trans>
          </LoadingText>
        }
        options={options}
        onChange={onChange}
        aside={
          <span className={selectStyles().aside()}>
            {datasets.isPending ? (
              <LoadingText>
                <Trans>확인 중</Trans>
              </LoadingText>
            ) : status?.state === "generating" ? (
              registering(status)
            ) : status?.state === "missing" ? (
              <Trans>미등록 · datastore에서 등록</Trans>
            ) : !status ? (
              <Trans>datastore에서 다른 데이터를 고르세요</Trans>
            ) : (
              ""
            )}
          </span>
        }
      />
    </div>
  );
}
