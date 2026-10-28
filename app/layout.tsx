import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { IntlRoot } from "@/application/IntlRoot";
import { DEFAULT_LOCALE, LOCALE_INIT_SCRIPT } from "@/shared/config/locale";
import { THEME_INIT_SCRIPT } from "@/shared/config/theme";
import { cn } from "@/shared/lib/tw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vis-a-lot",
  description: "서버사이드 렌더링 차트 프로토타입",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme·lang은 아래 스크립트가 첫 페인트 전에 고른 테마·언어로 바꾼다 (React가 모르는 값이라 경고를 끈다).
    <html
      lang={DEFAULT_LOCALE}
      data-theme="light"
      className={cn(geistSans.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 첫 페인트 전에 테마를 정하는 고정 문자열이다.
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 첫 페인트 전에 언어를 정하는 고정 문자열이다.
          dangerouslySetInnerHTML={{ __html: LOCALE_INIT_SCRIPT }}
        />
      </head>
      <body>
        <IntlRoot>{children}</IntlRoot>
      </body>
    </html>
  );
}
