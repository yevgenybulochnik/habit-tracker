import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SetInput from "./SetInput";
import { setsPreset } from "../lib/metrics";
import { PALETTES } from "../theme";
import type { SetEntry, SetsMetric } from "../types";

const bench: SetsMetric = {
  id: "m1",
  name: "Bench",
  mode: "sets",
  ...setsPreset("weighted", "lbs"),
};

/** SetInput over sets it keeps itself, as the day editor and quick-log do. */
function Harness({
  initial = [],
  lastSet = null,
  onAddSet = () => {},
}: {
  initial?: SetEntry[];
  lastSet?: SetEntry | null;
  onAddSet?: (metricId: string, set: SetEntry) => void;
}) {
  const [sets, setSets] = useState(initial);
  return (
    <SetInput
      metric={bench}
      sets={sets}
      pal={PALETTES[0]}
      onAddSet={(mId, set) => {
        onAddSet(mId, set);
        setSets((p) => [...p, set]);
      }}
      onRemoveSet={(_, i) => setSets((p) => p.filter((_, j) => j !== i))}
      lastSet={lastSet}
    />
  );
}

const weight = () => screen.getByPlaceholderText("Weight");
const reps = () => screen.getByPlaceholderText("Reps");
const addSet = () =>
  userEvent.click(screen.getByRole("button", { name: "+ Set" }));

describe("SetInput", () => {
  it("adds a set from the fields", async () => {
    const onAddSet = vi.fn();
    render(<Harness onAddSet={onAddSet} />);
    await userEvent.type(weight(), "135");
    await userEvent.type(reps(), "5");
    await addSet();
    expect(onAddSet).toHaveBeenCalledWith("m1", { w: 135, r: 5 });
  });

  it("adds on Enter too", async () => {
    const onAddSet = vi.fn();
    render(<Harness onAddSet={onAddSet} />);
    await userEvent.type(weight(), "135");
    await userEvent.type(reps(), "5{Enter}");
    expect(onAddSet).toHaveBeenCalledWith("m1", { w: 135, r: 5 });
  });

  it("adds nothing until every field is a positive number", async () => {
    const onAddSet = vi.fn();
    render(<Harness onAddSet={onAddSet} />);
    await userEvent.type(weight(), "135");
    await addSet();
    expect(onAddSet).not.toHaveBeenCalled();
  });

  it("keeps the weight and clears the reps after adding, ready for the next set", async () => {
    render(<Harness />);
    await userEvent.type(weight(), "135");
    await userEvent.type(reps(), "5");
    await addSet();
    expect(weight()).toHaveValue("135");
    expect(reps()).toHaveValue("");

    await userEvent.type(reps(), "4");
    await addSet();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("starts from the weight of today's last set", () => {
    render(<Harness initial={[{ w: 155, r: 3 }]} lastSet={{ w: 135, r: 5 }} />);
    expect(weight()).toHaveValue("155");
    expect(reps()).toHaveValue("");
  });

  it("starts from the last set before today when today has none", () => {
    render(<Harness lastSet={{ w: 135, r: 5 }} />);
    expect(weight()).toHaveValue("135");
    expect(reps()).toHaveValue("");
  });

  describe("when the sets change from outside", () => {
    // The quick-log's input stays mounted while the day editor adds to today.
    function renderOutside(sets: SetEntry[]) {
      const props = {
        metric: bench,
        pal: PALETTES[0],
        onAddSet: vi.fn(),
        onRemoveSet: vi.fn(),
        lastSet: null,
      };
      const view = render(<SetInput {...props} sets={sets} />);
      return (next: SetEntry[]) =>
        view.rerender(<SetInput {...props} sets={next} />);
    }

    it("shows the newest set's weight in an untouched field", () => {
      const setSets = renderOutside([{ w: 135, r: 5 }]);
      setSets([
        { w: 135, r: 5 },
        { w: 145, r: 3 },
      ]);
      expect(weight()).toHaveValue("145");
    });

    it("keeps what's been typed", async () => {
      const setSets = renderOutside([{ w: 135, r: 5 }]);
      await userEvent.clear(weight());
      await userEvent.type(weight(), "150");
      await userEvent.type(reps(), "2");
      setSets([
        { w: 135, r: 5 },
        { w: 145, r: 3 },
      ]);
      expect(weight()).toHaveValue("150");
      expect(reps()).toHaveValue("2");
    });
  });
});
