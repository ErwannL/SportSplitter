import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DURATIONS, fmtDuration, RHYTHM_PRESETS, RhythmEditor, Stepper, weeklyAverage } from "./RhythmEditor";

describe("helpers", () => {
  it("fmtDuration", () => {
    expect(fmtDuration(45)).toBe("45min");
    expect(fmtDuration(120)).toBe("2h");
    expect(fmtDuration(90)).toBe("1h30");
    expect(fmtDuration(125)).toBe("2h05");
  });
  it("weeklyAverage", () => {
    expect(weeklyAverage([[60, 60, 60, 60], [90, 90], []])).toBe(140);
    expect(weeklyAverage([[120], [240]])).toBe(180);
    expect(weeklyAverage([[]])).toBe(0);
  });
  it("constantes", () => {
    expect(DURATIONS).toContain(120);
    expect(RHYTHM_PRESETS.length).toBeGreaterThan(0);
  });
});

describe("RhythmEditor", () => {
  it("longueur du cycle : agrandit en recopiant la dernière semaine, réduit", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RhythmEditor cycle={[[60], [90, 90]]} onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "2 sem." })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Semaine A")).toBeInTheDocument();
    expect(screen.getByText("Semaine B")).toBeInTheDocument();
    expect(screen.getByText("≈ 2h par semaine")).toBeInTheDocument();
    await userEvent.click(screen.getByText("4 sem."));
    expect(onChange).toHaveBeenLastCalledWith([[60], [90, 90], [90, 90], [90, 90]]);
    const grown = onChange.mock.lastCall![0] as number[][];
    expect(grown[2]).not.toBe(grown[1]);
    await userEvent.click(screen.getByText("1 sem."));
    expect(onChange).toHaveBeenLastCalledWith([[60]]);
    rerender(<RhythmEditor cycle={[[60]]} onChange={onChange} />);
    expect(screen.queryByText("Semaine A")).toBeNull();
    rerender(<RhythmEditor cycle={[]} onChange={onChange} />);
    await userEvent.click(screen.getByText("2 sem."));
    expect(onChange).toHaveBeenLastCalledWith([[], []]);
  });

  it("préréglages copiés", async () => {
    const onChange = vi.fn();
    render(<RhythmEditor cycle={[[60]]} onChange={onChange} />);
    await userEvent.click(screen.getByText("2h / 4h"));
    expect(onChange).toHaveBeenLastCalledWith([[120], [240]]);
    (onChange.mock.lastCall![0] as number[][])[0].push(1);
    expect(RHYTHM_PRESETS[3].cycle[0]).toEqual([120]);
  });

  it("ajoute et retire des séances, semaine vide", async () => {
    const onChange = vi.fn();
    render(<RhythmEditor cycle={[[60, 90], []]} onChange={onChange} />);
    expect(screen.getByText("Pas d'EPS")).toBeInTheDocument();
    expect(screen.getByText("≈ 1h15 par semaine")).toBeInTheDocument();
    const selects = screen.getAllByLabelText("Séance");
    fireEvent.change(selects[1], { target: { value: "150" } });
    expect(onChange).toHaveBeenLastCalledWith([[60, 90], [150]]);
    await userEvent.click(screen.getByLabelText("Retirer la séance de 1h"));
    expect(onChange).toHaveBeenLastCalledWith([[90], []]);
  });
});

describe("Stepper", () => {
  it("bornes", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper value={1} min={1} max={3} label="n" onChange={onChange} />);
    expect(screen.getByLabelText("Moins")).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Plus"));
    expect(onChange).toHaveBeenLastCalledWith(2);
    rerender(<Stepper value={3} min={1} max={3} label="n" onChange={onChange} />);
    expect(screen.getByLabelText("Plus")).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Moins"));
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
