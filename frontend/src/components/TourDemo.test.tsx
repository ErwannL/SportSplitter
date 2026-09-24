import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePrefs } from "../prefs";
import { FRAME_MS, SCENES, TourDemo } from "./TourDemo";

describe("TourDemo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(SCENES.map((_, i) => i))("joue toutes les images de la scène %i puis signale la fin", (scene) => {
    const end = vi.fn();
    render(<TourDemo scene={scene} onSceneEnd={end} />);
    const demo = screen.getByTestId("tour-demo");
    for (let f = 1; f < SCENES[scene].length; f++) {
      act(() => void vi.advanceTimersByTime(FRAME_MS));
      expect(demo.dataset.frame).toBe(String(f));
    }
    expect(end).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(FRAME_MS));
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("affiche les libellés traduits", () => {
    usePrefs.setState({ lang: "en" });
    render(<TourDemo scene={1} onSceneEnd={() => undefined} />);
    for (let k = 0; k < 5; k++) act(() => void vi.advanceTimersByTime(FRAME_MS));
    expect(screen.getAllByText("Semester").length).toBeGreaterThan(0);
  });
});
