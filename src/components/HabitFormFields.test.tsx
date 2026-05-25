import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HabitFormFields from "./HabitFormFields";
import { BUILTIN_UNITS } from "../constants";
import type { IntensityMode, Metric } from "../types";

function Harness() {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎯");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("Green");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intensityMode, setIntensityMode] = useState<IntensityMode>("total");
  return (
    <HabitFormFields
      name={name} setName={setName}
      emoji={emoji} setEmoji={setEmoji}
      description={description} setDescription={setDescription}
      color={color} setColor={setColor}
      metrics={metrics} setMetrics={setMetrics}
      intensityMode={intensityMode} setIntensityMode={setIntensityMode}
      units={BUILTIN_UNITS} onAddUnit={() => {}}
    />
  );
}

describe("HabitFormFields", () => {
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

  it("reveals the sets presets when sets mode is enabled (weighted default)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByText(/Log weight × reps per set/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Enable sets mode/i }));
    expect(screen.getByText(/Log weight × reps per set/i)).toBeInTheDocument();
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
});
