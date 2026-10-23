import { expect, test } from "vitest";
import { cn } from "@/shared/lib/tw";

test("merge", () => {
  expect(cn("text-fg text-xs", "text-ui")).toBe("text-fg text-ui");
  expect(cn("text-fg", "text-accent")).toBe("text-accent");
  expect(cn("shadow-card", "shadow-xl")).toBe("shadow-xl");
  expect(cn("px-2", false, undefined, "px-3")).toBe("px-3");
});
