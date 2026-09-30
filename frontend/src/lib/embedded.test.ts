import { afterEach, describe, expect, it, vi } from "vitest";
import { inIframe } from "./embedded";

describe("inIframe", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("faux en haut de page, vrai dans un iframe", () => {
    expect(inIframe()).toBe(false);
    vi.spyOn(window, "top", "get").mockReturnValue({} as Window);
    expect(inIframe()).toBe(true);
  });
});
