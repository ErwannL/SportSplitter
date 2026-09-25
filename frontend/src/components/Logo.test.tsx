import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo, LogoLoader, SLICES } from "./Logo";

describe("Logo", () => {
  it("statique par défaut, décoratif (caché aux lecteurs d'écran), trois tranches", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("ss-logo", "ss-logo--static");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "36");
    expect(container.querySelectorAll(".ss-slice")).toHaveLength(SLICES.length);
  });

  it("chaque tranche porte son décalage au repos et au sommet de la vague", () => {
    const { container } = render(<Logo mode="hover" />);
    const slices = [...container.querySelectorAll<SVGGElement>(".ss-slice")];
    expect(slices.map((s) => s.style.getPropertyValue("--ss-rest"))).toEqual(["-3px", "0px", "3px"]);
    expect(slices.map((s) => s.style.animationDelay)).toEqual(["0s", "0.12s", "0.24s"]);
    expect(container.querySelector("svg")).toHaveClass("ss-logo--hover");
  });

  it("deux logos sur la page n'ont pas les mêmes identifiants de dégradé", () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("LogoLoader : le logo qui ondule en continu, nommé quand on lui donne un libellé", () => {
    render(<LogoLoader size={20} label="Chargement" />);
    const img = screen.getByRole("img", { name: "Chargement" });
    expect(img).toHaveClass("ss-logo--loop", "shrink-0");
    expect(img).toHaveAttribute("width", "20");
  });
});
