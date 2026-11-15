import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HabitFormFields from "./HabitFormFields";
import { BUILTIN_UNITS } from "../lib/defaults";
import type { IntensityMode, Metric, Unit } from "../types";

/** The form with its state, and units that grow as the form adds them. */
function Harness({ onAddUnit = () => {} }: { onAddUnit?: (u: Unit) => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("Green");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intensityMode, setIntensityMode] = useState<IntensityMode>("total");
  const [units, setUnits] = useState(BUILTIN_UNITS);
  const form = (
    <HabitFormFields
      name={name}
      setName={setName}
      emoji={emoji}
      setEmoji={setEmoji}
      description={description}
      setDescription={setDescription}
      color={color}
      setColor={setColor}
      metrics={metrics}
      setMetrics={setMetrics}
      intensityMode={intensityMode}
      setIntensityMode={setIntensityMode}
      units={units}
      onAddUnit={(u) => {
        onAddUnit(u);
        setUnits((p) => [...p, u]);
      }}
    />
  );
  return (
    <>
      <output data-testid="intensity-mode">{intensityMode}</output>
      {form}
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HabitFormFields", () => {
  /** Add a sets metric with the given preset through the form. */
  async function addSetsMetric(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
    preset: "Weighted" | "Reps only",
  ) {
    await user.type(screen.getByPlaceholderText(/Metric name/i), name);
    await user.click(screen.getByRole("button", { name: /Enable sets mode/i }));
    await user.click(screen.getByRole("button", { name: preset }));
    await user.click(screen.getByRole("button", { name: /\+ Add/i }));
  }
  const mode = () => screen.getByTestId("intensity-mode").textContent;

  it("adds a metric to the list", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByPlaceholderText(/Metric name/i), "Bench Press");
    await user.click(screen.getByRole("button", { name: /\+ Add/i }));
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
  });

  it("removes a metric", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByPlaceholderText(/Metric name/i), "Squats");
    await user.click(screen.getByRole("button", { name: /\+ Add/i }));
    expect(screen.getByText("Squats")).toBeInTheDocument();
    await user.click(screen.getByText("×"));
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
  });

  it("removes only the chosen metric when two were added in the same millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const user = userEvent.setup();
    render(<Harness />);
    for (const name of ["Squats", "Lunges"]) {
      await user.type(screen.getByPlaceholderText(/Metric name/i), name);
      await user.click(screen.getByRole("button", { name: /\+ Add/i }));
    }
    await user.click(screen.getAllByText("×")[0]);
    expect(screen.queryByText("Squats")).not.toBeInTheDocument();
    expect(screen.getByText("Lunges")).toBeInTheDocument();
  });

  it("reveals the sets presets when sets mode is enabled (weighted default)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      screen.queryByText(/Log weight × reps per set/i),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Enable sets mode/i }));
    expect(screen.getByText(/Log weight × reps per set/i)).toBeInTheDocument();
  });

  // Volume (weight × reps) and plain reps can't be added into one total.
  it("colours by coverage once a weighted and a reps-only metric are combined", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addSetsMetric(user, "Bench", "Weighted");
    expect(mode()).toBe("total");
    await addSetsMetric(user, "Pull-ups", "Reps only");
    expect(mode()).toBe("coverage");
  });

  it("keeps summing a habit whose metrics are all weighted", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await addSetsMetric(user, "Bench", "Weighted");
    await addSetsMetric(user, "Squat", "Weighted");
    expect(mode()).toBe("total");
  });

  it("adds a reps-only (bodyweight) sets metric via the preset", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByPlaceholderText(/Metric name/i), "Pull-ups");
    await user.click(screen.getByRole("button", { name: /Enable sets mode/i }));
    await user.click(screen.getByRole("button", { name: "Reps only" }));
    expect(screen.getByText(/Log reps per set/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeNull(); // unit select still present
    await user.click(screen.getByRole("button", { name: /\+ Add/i }));
    // metric chip shows the reps-based badge, not "lbs"
    expect(screen.getByText("SETS · reps")).toBeInTheDocument();
  });

  describe("custom unit", () => {
    async function openCustomUnit(user: ReturnType<typeof userEvent.setup>) {
      await user.selectOptions(screen.getByRole("combobox"), "+ Custom...");
    }

    it("adds a unit from the unit menu and picks it for the next metric", async () => {
      const user = userEvent.setup();
      const onAddUnit = vi.fn();
      render(<Harness onAddUnit={onAddUnit} />);
      await openCustomUnit(user);
      await user.type(screen.getByLabelText("ID"), "Laps");
      await user.type(screen.getByLabelText("Label"), "Pool laps");
      await user.click(screen.getByRole("button", { name: "Add Unit" }));

      expect(onAddUnit).toHaveBeenCalledWith({
        id: "laps",
        label: "Pool laps",
        quickAdd: [1, 5, 10],
        thresholds: [1, 3, 5],
      });
      expect(screen.queryByLabelText("ID")).not.toBeInTheDocument();
      expect(screen.getByRole("combobox")).toHaveValue("laps");

      await user.type(screen.getByPlaceholderText(/Metric name/i), "Swim");
      await user.click(screen.getByRole("button", { name: /\+ Add/i }));
      expect(
        screen.getByText("Pool laps", { selector: "span" }),
      ).toBeInTheDocument();
    });

    it("won't add a unit whose id is taken, and says so", async () => {
      const user = userEvent.setup();
      const onAddUnit = vi.fn();
      render(<Harness onAddUnit={onAddUnit} />);
      await openCustomUnit(user);
      await user.type(screen.getByLabelText("ID"), "min");
      await user.type(screen.getByLabelText("Label"), "Mins");
      await user.click(screen.getByRole("button", { name: "Add Unit" }));

      expect(screen.getByRole("alert")).toHaveTextContent(/already a unit/);
      expect(onAddUnit).not.toHaveBeenCalled();
      expect(screen.getByLabelText("ID")).toBeInTheDocument(); // still open
    });

    it("closes without adding on Cancel", async () => {
      const user = userEvent.setup();
      const onAddUnit = vi.fn();
      render(<Harness onAddUnit={onAddUnit} />);
      await openCustomUnit(user);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByLabelText("ID")).not.toBeInTheDocument();
      expect(onAddUnit).not.toHaveBeenCalled();
    });
  });
});
