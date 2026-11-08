// 도움말(apps/help) 경로. 도움말은 다른 앱이 /help/** 아래에서 내보내므로, web 앱이 도움말로 링크할 때도
// 이 경로를 쓴다. 목차와 문구는 도움말 앱(apps/help/src/shared/config/help.ts)에 둔다.

export const HELP_ROOT = "/help";

export const HELP_SERVICES = ["vis", "feed"] as const;
export type HelpService = (typeof HELP_SERVICES)[number];

export const helpServicePath = (service: HelpService) =>
  `${HELP_ROOT}/${service}`;

export const helpArticlePath = (service: HelpService, slug: string) =>
  `${HELP_ROOT}/${service}/${slug}`;

export function isHelpService(value: string): value is HelpService {
  return (HELP_SERVICES as readonly string[]).includes(value);
}
