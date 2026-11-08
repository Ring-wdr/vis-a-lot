import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { LinguiProvider } from "./lingui-provider";

/** 컴포넌트 렌더 테스트용 render. 앱에서처럼 Lingui context로 감싼다 (앱은 application/providers.tsx가 감싼다). */
export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: LinguiProvider, ...options });
}
