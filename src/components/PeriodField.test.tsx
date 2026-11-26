import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PeriodField from "./PeriodField";
import type { Period } from "../types";

/** The field with its state; the period it holds is in an output. */
function Harness({
  initial,
  onChange = () => {},
}: {
  initial: Period;
  onChange?: (p: Period) => void;
}) {
  const [period, setPeriod] = useState(initial);
  return (
    <>
      <output data-testid="period">{JSON.stringify(period)}</output>
      <PeriodField
        value={period}
        onChange={(p) => {
          onChange(p);
          setPeriod(p);
        }}
      />
    </>
  );
}

const held = () => JSON.parse(screen.getByTestId("period").textContent!);
const number = () => screen.getByRole("spinbutton", { name: "How often" });
const unit = () => screen.getByRole("combobox", { name: "Days or weeks" });

describe("PeriodField", () => {
  it("shows how often: every so many days or weeks", () => {
    render(<Harness initial={{ every: 2, unit: "day" }} />);
    expect(number()).toHaveValue(2);
    expect(unit()).toHaveValue("day");
    expect(screen.getByRole("option", { name: "days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "weeks" })).toBeInTheDocument();
  });

  it("says how far apart the logs may be", () => {
    render(<Harness initial={{ every: 2, unit: "day" }} />);
    expect(
      screen.getByText(/no more than 2 days apart/, { exact: false }),
    ).toBeInTheDocument();
  });

  it("says every day, a day or a week, in the singular", async () => {
    render(<Harness initial={{ every: 1, unit: "day" }} />);
    expect(screen.getByRole("option", { name: "day" })).toBeInTheDocument();
    expect(screen.getByText(/log every day/)).toBeInTheDocument();
    await userEvent.selectOptions(unit(), "week");
    expect(held()).toEqual({ every: 1, unit: "week" });
    expect(screen.getByText(/no more than a week apart/)).toBeInTheDocument();
  });

  it("changes the number of days", async () => {
    render(<Harness initial={{ every: 2, unit: "day" }} />);
    await userEvent.clear(number());
    await userEvent.type(number(), "3");
    expect(held()).toEqual({ every: 3, unit: "day" });
  });

  it("keeps the period while the number is one it can't take", async () => {
    const onChange = vi.fn();
    render(<Harness initial={{ every: 2, unit: "day" }} onChange={onChange} />);
    await userEvent.clear(number());
    expect(number()).toHaveValue(null);
    await userEvent.type(number(), "45"); // more than a month of days
    expect(number()).toHaveValue(45);
    expect(held()).toEqual({ every: 4, unit: "day" }); // the "4" on the way
    await userEvent.clear(number());
    await userEvent.type(number(), "0");
    expect(held()).toEqual({ every: 4, unit: "day" });
    expect(onChange).not.toHaveBeenCalledWith({ every: 0, unit: "day" });
  });

  it("shows the period's number again on leaving one it can't take", async () => {
    render(<Harness initial={{ every: 2, unit: "day" }} />);
    await userEvent.clear(number());
    await userEvent.tab();
    expect(number()).toHaveValue(2);
  });

  it("keeps the number in weeks to at most 8", async () => {
    render(<Harness initial={{ every: 20, unit: "day" }} />);
    await userEvent.selectOptions(unit(), "week");
    expect(held()).toEqual({ every: 8, unit: "week" });
    expect(number()).toHaveValue(8);
    await userEvent.selectOptions(unit(), "day");
    expect(held()).toEqual({ every: 8, unit: "day" });
  });
});
