import { describe, expect, it } from "vitest";
import {
  findHelpArticle,
  HELP,
  HELP_SERVICES,
  helpArticleParams,
  isHelpService,
} from "./help";

describe("도움말 목차", () => {
  it("서비스 안에서 slug가 겹치지 않는다", () => {
    for (const service of HELP_SERVICES) {
      const slugs = HELP[service].articles.map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("slug는 URL에 그대로 쓸 수 있는 kebab-case다", () => {
    for (const { slug } of helpArticleParams()) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("문서의 이전·다음을 목차 순서로 찾는다", () => {
    const [first, second] = HELP.vis.articles;
    expect(findHelpArticle("vis", first.slug)).toEqual({
      article: first,
      prev: undefined,
      next: second,
    });
    expect(findHelpArticle("vis", second.slug)?.prev).toBe(first);
    expect(findHelpArticle("vis", "없는-문서")).toBeUndefined();
  });

  it("문서가 없는 서비스는 미리 만들 문서 경로도 없다", () => {
    expect(helpArticleParams().some((p) => p.service === "feed")).toBe(false);
  });

  it("서비스 이름을 가린다", () => {
    expect(isHelpService("vis")).toBe(true);
    expect(isHelpService("docs")).toBe(false);
  });
});
