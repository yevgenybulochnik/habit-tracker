// A page's way back, under test. In the app the pearl takes it from the
// page's header (PageBackContext): render a page with `wrapper:
// PageBackWrapper`, and `back()` goes back as tapping the pearl does.
import type { ReactNode } from "react";
import { act } from "@testing-library/react";
import { PageBackContext } from "../components/PageShell";

let backs: (() => void)[] = [];

const register = (back: () => void) => {
  backs.push(back);
  return () => {
    backs = backs.filter((b) => b !== back);
  };
};

export function PageBackWrapper({ children }: { children: ReactNode }) {
  return (
    <PageBackContext.Provider value={register}>
      {children}
    </PageBackContext.Provider>
  );
}

/** Go back from the page that's up, as the pearl does. */
export function back() {
  act(() => backs.at(-1)?.());
}
