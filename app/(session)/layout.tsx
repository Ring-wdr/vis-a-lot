import { ClientApp } from "@/application/client-app";

/**
 * 로그인해야 쓰는 화면들. 로그인 확인과 세션 동안만 사는 상태(탭, 팝업)를 이 layout이 맡아,
 * 아래 page는 로그인한 상태라고 보고 화면만 그린다.
 */
export default function SessionLayout({ children }: LayoutProps<"/">) {
  return <ClientApp>{children}</ClientApp>;
}
