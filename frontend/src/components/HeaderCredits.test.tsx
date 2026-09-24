import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePrefs } from "../prefs";
import { CREDITS } from "../lib/credits";
import { HeaderCredits } from "./HeaderCredits";

describe("HeaderCredits", () => {
  it("rend les deux liens (href, target, rel, aria-label) en français", () => {
    render(<HeaderCredits />);
    const owner = screen.getByRole("link", { name: "Propulsé par Orqea (nouvel onglet)" });
    const author = screen.getByRole("link", { name: "Développé par Erwann Laplante (nouvel onglet)" });
    expect(owner).toHaveAttribute("href", "https://orqea.dev");
    expect(author).toHaveAttribute("href", "https://github.com/ErwannL/ErwannL");
    for (const a of [owner, author]) {
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveAttribute("rel", "noreferrer noopener");
    }
    expect(owner).toHaveTextContent("Propulsé par Orqea");
  });

  it("libellés anglais", () => {
    usePrefs.setState({ lang: "en" });
    render(<HeaderCredits />);
    expect(screen.getByRole("link", { name: "Boosted by Orqea (new tab)" })).toHaveTextContent("Boosted by Orqea");
    expect(screen.getByRole("link", { name: "Developed by Erwann Laplante (new tab)" })).toBeInTheDocument();
  });

  it("une ligne disparaît si son nom est vide, rien si les deux le sont", () => {
    const { rerender, container } = render(<HeaderCredits credits={{ ...CREDITS, author: { name: "", href: "x" } }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    rerender(<HeaderCredits credits={{ owner: { name: "", href: "x" }, author: CREDITS.author }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveTextContent("Développé par Erwann Laplante");
    rerender(<HeaderCredits credits={{ owner: { name: "", href: "x" }, author: { name: "", href: "y" } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("compact : seulement « Orqea », aria-label complet ; rien sans propriétaire", () => {
    const { rerender, container } = render(<HeaderCredits compact />);
    const link = screen.getByRole("link", { name: "Propulsé par Orqea (nouvel onglet)" });
    expect(link).toHaveTextContent(/^Orqea$/);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    rerender(<HeaderCredits compact credits={{ owner: { name: "", href: "x" }, author: CREDITS.author }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
