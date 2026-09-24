import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useStore } from "../store";
import { renderAt } from "../test/utils";
import { ConfigurationPage, fillCost, fillOrder } from "./Configuration";

describe("fillOrder", () => {
  it("haut gauche : lundi 8h d'abord, puis la journée, puis mardi", () => {
    const o = fillOrder({ fillVertical: "top", fillHorizontal: "left" });
    expect(o[0][0]).toBe(1);
    expect(o[1][0]).toBe(2);
    expect(o[0][1]).toBe(7);
  });
  it("bas seul : toutes les fins de journée d'abord", () => {
    const o = fillOrder({ fillVertical: "bottom", fillHorizontal: "none" });
    expect(o[5]).toEqual([1, 1, 1, 1, 1]);
    expect(o[0][0]).toBe(6);
  });
  it("haut droite : vendredi 8h d'abord ; indifférent partout = tout égal", () => {
    expect(fillOrder({ fillVertical: "top", fillHorizontal: "right" })[0][4]).toBe(1);
    expect(new Set(fillOrder({ fillVertical: "none", fillHorizontal: "none" }).flat())).toEqual(new Set([1]));
    expect(fillCost({ fillVertical: "bottom", fillHorizontal: "right" }, 4, 5)).toBe(0);
  });
});

describe("ConfigurationPage", () => {
  it("modifie le sens de remplissage", async () => {
    renderAt(<ConfigurationPage />);
    const u = userEvent.setup();
    expect(screen.getByRole("radio", { name: /Le matin d'abord/ })).toHaveAttribute("aria-checked", "true");
    await u.click(screen.getByRole("radio", { name: /Le soir d'abord/ }));
    await u.click(screen.getByRole("radio", { name: /Vendredi d'abord/ }));
    expect(useStore.getState().ws.preferences).toEqual({ fillVertical: "bottom", fillHorizontal: "right" });
    await u.click(screen.getAllByRole("radio", { name: /Indifférent/ })[0]);
    await u.click(screen.getAllByRole("radio", { name: /Indifférent/ })[1]);
    expect(screen.getByTestId("fill-preview").textContent).toContain("1");
  });
});
