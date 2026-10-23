import { expect, test } from "vitest";
import { cn } from "@/shared/lib/tw";

test("merge", () => {
  expect(cn("text-12 text-fg", "text-13")).toBe("text-fg text-13");
  expect(cn("text-fg", "text-accent")).toBe("text-accent");
  expect(cn("shadow-card", "shadow-xl")).toBe("shadow-xl");
  expect(cn("px-2", false, undefined, "px-3")).toBe("px-3");
});
