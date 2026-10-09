import { describe, expect, it } from "vitest";
import { noop } from "@/lib/noop";

describe("noop polyfill module", () => {
  it("exports a callable no-op function", () => {
    expect(noop()).toBeUndefined();
  });
});
