import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "./auth";
import { App, AppRoutes } from "./App";
import { usePrefs } from "./prefs";
import { useStore } from "./store";
import { jsonRes, mockFetch } from "./test/utils";

describe("App", () => {
  beforeEach(() => {
    useAuth.setState({ status: "loading", me: null });
    window.history.pushState(null, "", "/");
  });
  it("charge puis affiche, me OK, flush au pagehide", async () => {
    const me = { sub: "u9", email: "p@x", name: "Paul", role: "prof", permissions: ["edit_rules"] };
    const f = mockFetch(async (url) => (url === "/api/me" ? jsonRes(me) : jsonRes({})));
    const { unmount } = render(<App />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect((await screen.findAllByText(/Importer/)).length).toBeGreaterThan(0);
    expect(usePrefs.getState().me).toEqual(me);
    expect(useAuth.getState()).toMatchObject({ status: "authenticated", me });
    expect(useStore.getState().sub).toBe("u9");
    useStore.getState().addLevel("Z");
    window.dispatchEvent(new Event("pagehide"));
    await waitFor(() => expect(f.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true));
    unmount();
  });
  it("routes : admin autorisé, redirections", () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Administration").length).toBeGreaterThan(1);
    unmount();
    usePrefs.setState({ me: { sub: "u2", email: "", name: "Prof", role: "prof", permissions: [] } });
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
