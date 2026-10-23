import { expect, test } from "vitest";
import { cn } from "@/shared/lib/tw";

test("merge", () => {
  expect(cn("text-xs text-fg", "text-ui")).toBe("text-fg text-ui");
  expect(cn("text-fg", "text-accent")).toBe("text-accent");
  expect(cn("shadow-card", "shadow-xl")).toBe("shadow-xl");
  expect(cn("px-2", false, undefined, "px-3")).toBe("px-3");
  expect(cn("z-sticky-col sticky", "z-sticky-corner")).toBe(
    "sticky z-sticky-corner",
  );
});
