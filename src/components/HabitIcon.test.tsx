import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import HabitIcon from "./HabitIcon";
import { ICON_IDS } from "../lib/icons";

describe("HabitIcon", () => {
  it("draws every icon, hidden from a screen reader (its name is said beside it)", () => {
    for (const id of ICON_IDS) {
      const { container, unmount } = render(<HabitIcon icon={id} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("aria-hidden"), id).toBe("true");
      expect(svg.querySelector("path"), id).not.toBeNull();
      unmount();
    }
  });

  it("is 18px unless sized", () => {
    const { container } = render(
      <>
        <HabitIcon icon="guitar" />
        <HabitIcon icon="guitar" size={40} />
      </>,
    );
    const [small, big] = container.querySelectorAll("svg");
    expect(small.getAttribute("width")).toBe("18");
    expect(big.getAttribute("width")).toBe("40");
    expect(big.getAttribute("height")).toBe("40");
  });
});
