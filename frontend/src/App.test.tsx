import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App, AppRoutes } from "./App";
import { usePrefs } from "./prefs";
import { useStore } from "./store";
import { jsonRes, mockFetch } from "./test/utils";

describe("App", () => {
  it("charge puis affiche, me OK, flush au pagehide", async () => {
    const f = mockFetch(async (url) => (url === "/api/me" ? jsonRes({ role: "prof", permissions: ["edit_rules"] }) : jsonRes({})));
    const { unmount } = render(<App />);
    expect((await screen.findAllByText(/Importer/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(usePrefs.getState().me.role).toBe("prof"));
    useStore.getState().addLevel("Z");
    window.dispatchEvent(new Event("pagehide"));
    await waitFor(() => expect(f.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    unmount();
  });
  it("me en échec ignoré", async () => {
    render(<App />);
    expect((await screen.findAllByText(/Importer/)).length).toBeGreaterThan(0);
    expect(usePrefs.getState().me.role).toBe("admin");
  });
  it("routes : admin autorisé, redirections", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Administration").length).toBeGreaterThan(1);
    unmount();
    usePrefs.setState({ me: { role: "prof", permissions: [] } });
    const r2 = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Administration")).toBeNull();
    r2.unmount();
    render(
      <MemoryRouter initialEntries={["/nope"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/Importer/).length).toBeGreaterThan(0);
  });
});
