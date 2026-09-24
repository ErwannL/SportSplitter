import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readyWs } from "../test/utils";
import { TimetableGrid } from "./TimetableGrid";

describe("TimetableGrid", () => {
  it("rendu complet et compact, événements sur cellules ouvertes seulement", () => {
    const tt = readyWs().timetable!;
    const down = vi.fn();
    const enter = vi.fn();
    const { rerender } = render(<TimetableGrid timetable={tt} dim renderCell={(_, id) => <span>cell {id}</span>} />);
    expect(screen.getByText("Lundi")).toBeInTheDocument();
    expect(screen.getByText("M2")).toBeInTheDocument();
    rerender(
      <TimetableGrid
        compact
        timetable={tt}
        renderCell={(_, id) => <span>cell {id}</span>}
        cellClassName={() => "x"}
        onCellPointerDown={down}
        onCellPointerEnter={enter}
      />,
    );
    expect(screen.getByText("Lun")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("cell 0-0").parentElement!);
    fireEvent.pointerEnter(screen.getByText("cell 0-0").parentElement!);
    fireEvent.pointerDown(screen.getByText("cell 0-1").parentElement!);
    expect(down).toHaveBeenCalledTimes(1);
    expect(enter).toHaveBeenCalledTimes(1);
    const closed = vi.fn();
    rerender(<TimetableGrid timetable={tt} renderCell={(_, id) => <span>cell {id}</span>} onClosedPointerDown={closed} />);
    fireEvent.pointerDown(screen.getByText("cell 0-0").parentElement!);
    fireEvent.pointerDown(screen.getByText("cell 0-1").parentElement!);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(closed.mock.calls[0][1]).toBe("0-1");
  });
});
