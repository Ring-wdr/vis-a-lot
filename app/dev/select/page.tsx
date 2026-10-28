import { LinguiProvider } from "@/shared/lib/lingui-provider";
import { DevSelectPage } from "@/views/dev-select/ui/DevSelectPage";

/**
 * OrderedSelect 검증용 정적 페이지: 대량(10,000개) 옵션과 실제 컬럼 옵션을 함께 띄운다.
 * Providers 밖이라 OrderedSelect가 쓰는 Lingui context를 여기서 연다.
 */
export default function Page() {
  return (
    <LinguiProvider>
      <DevSelectPage />
    </LinguiProvider>
  );
}
