import { DevClientApp } from "@/application/dev-client-app";
import { BootCheck } from "@/views/dev/ui/boot-check";

/** 구조 검증용 페이지: DB Worker, 데이터 생성, Render Worker 병렬 렌더 경로를 확인한다. */
export default function DevPage() {
  return (
    <DevClientApp>
      <BootCheck />
    </DevClientApp>
  );
}
