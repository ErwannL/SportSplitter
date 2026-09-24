import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderAt } from "../test/utils";
import { AddColumn, AddPicker, Button, Checkbox, Chip, Column, InlineEdit, PageHeader, Segmented } from "./ui";

describe("ui", () => {
  it("Button variantes et tailles", () => {
    render(
      <>
        <Button>a</Button>
        <Button variant="primary" size="sm">b</Button>
        <Button variant="ghost" size="lg">c</Button>
        <Button variant="danger">d</Button>
      </>,
    );
    expect(screen.getByText("b")).toHaveClass("h-8");
  });
  it("Checkbox et Segmented", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Checkbox label="L" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByText("L"));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<Checkbox label="L" checked onChange={onChange} />);
    const seg = vi.fn();
    render(<Segmented value="a" onChange={seg} options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />);
    await userEvent.click(screen.getByText("B"));
    expect(seg).toHaveBeenCalledWith("b");
  });
  it("InlineEdit valide, annule si vide ou identique", async () => {
    const onChange = vi.fn();
    render(<InlineEdit value="x" onChange={onChange} />);
    const input = screen.getByDisplayValue("x");
    await userEvent.clear(input);
    await userEvent.type(input, "yo{Enter}");
    expect(onChange).toHaveBeenCalledWith("yo");
    await userEvent.clear(input);
    await userEvent.type(input, "  ");
    fireEvent.blur(input);
    expect(input).toHaveValue("x");
    await userEvent.type(input, "a");
    fireEvent.keyDown(input, { key: "a" });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  it("Chip sans couleur ni suppression, PageHeader minimal, AddColumn", async () => {
    const add = vi.fn();
    renderAt(
      <>
        <Chip label="c" />
        <PageHeader title="T" subtitle="S" />
        <AddColumn label="Add" onAdd={add} />
      </>,
    );
    expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();
    await userEvent.click(screen.getByText("Add"));
    expect(add).toHaveBeenCalled();
  });
  it("Column mise en évidence via ?focus", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const del = vi.fn();
    renderAt(
      <>
        <Column id="a" title="A" onRename={() => {}} onDelete={del}>x</Column>
        <Column id="b" title="B" accent="#000" onRename={() => {}} onDelete={() => {}}>y</Column>
      </>,
      "/?focus=a",
    );
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(document.getElementById("col-a")).toHaveClass("focus-flash");
    await userEvent.click(screen.getAllByLabelText("Supprimer")[0]);
    expect(del).toHaveBeenCalled();
  });
  it("AddPicker : choisir, créer, Échap, Entrée, clic extérieur", async () => {
    const onPick = vi.fn();
    const onCreate = vi.fn();
    render(
      <div>
        <span>outside</span>
        <AddPicker
          placeholder="ph"
          options={[{ id: "1", name: "Foot" }, { id: "2", name: "Hand" }]}
          exclude={["2"]}
          onPick={onPick}
          onCreate={onCreate}
        />
      </div>,
    );
    const u = userEvent.setup();
    fireEvent.mouseDown(screen.getByText("outside"));
    await u.click(screen.getByRole("button"));
    expect(screen.getByText("Foot")).toBeInTheDocument();
    expect(screen.queryByText("Hand")).toBeNull();
    await u.click(screen.getByText("Foot"));
    expect(onPick).toHaveBeenCalledWith("1");

    await u.click(screen.getByRole("button"));
    await u.click(screen.getByPlaceholderText("ph"));
    await u.type(screen.getByPlaceholderText("ph"), "zzz");
    await u.click(screen.getByText(/zzz/));
    expect(onCreate).toHaveBeenCalledWith("zzz");

    await u.click(screen.getByRole("button"));
    await u.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText("ph")).toBeNull();

    await u.click(screen.getByRole("button"));
    await u.keyboard("{Enter}");
    await u.keyboard("hand{Enter}");
    expect(onPick).toHaveBeenCalledWith("2");
    await u.click(screen.getByRole("button"));
    await u.keyboard("New{Enter}");
    expect(onCreate).toHaveBeenCalledWith("New");

    await u.click(screen.getByRole("button"));
    await u.keyboard("foot");
    expect(screen.queryByText(/Créer/)).toBeNull();
    await u.clear(screen.getByPlaceholderText("ph"));
    await u.keyboard("xx");
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByPlaceholderText("ph")).toBeNull();
  });
  it("AddPicker sans option affiche l'aide", async () => {
    render(<AddPicker placeholder="ph" options={[]} exclude={[]} onPick={() => {}} onCreate={() => {}} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByPlaceholderText("ph").parentElement!.textContent).not.toBe("");
  });
});
