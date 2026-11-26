import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HabitFormFields from "./HabitFormFields";
import { ICON_IDS, ICON_NAMES } from "../lib/icons";
import type { IconId } from "../lib/icons";
import { BUILTIN_UNITS } from "../lib/defaults";
import type { Group, IntensityMode, Metric, Period, Unit } from "../types";

const MUSIC: Group = {
  id: "g1",
  name: "Music",
  icon: "music",
  collapsed: false,
};
const FITNESS: Group = {
  id: "g2",
  name: "Fitness",
  icon: "weightlifter",
  collapsed: false,
};

/** The form with its state, and units and groups that grow as it adds them. */
function Harness({
  onAddUnit = () => {},
  onAddGroup = () => {},
  initialGroups = [MUSIC, FITNESS],
}: {
  onAddUnit?: (u: Unit) => void;
  onAddGroup?: (g: Group) => void;
  initialGroups?: Group[];
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<IconId>("target");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("Green");
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [intensityMode, setIntensityMode] = useState<IntensityMode>("total");
  const [units, setUnits] = useState(BUILTIN_UNITS);
  const [groupId, setGroupId] = useState("");
  const [groups, setGroups] = useState(initialGroups);
  const [period, setPeriod] = useState<Period>({ every: 1, unit: "day" });
  const form = (
    <HabitFormFields
      name={name}
      setName={setName}
      icon={icon}
      setIcon={setIcon}
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
      groupId={groupId}
      setGroupId={setGroupId}
      groups={groups}
      onAddGroup={(g) => {
        onAddGroup(g);
        setGroups((p) => [...p, g]);
      }}
      period={period}
      setPeriod={setPeriod}
    />
  );
  return (
    <>
      <output data-testid="intensity-mode">{intensityMode}</output>
      <output data-testid="group">{groupId}</output>
      <output data-testid="period">{JSON.stringify(period)}</output>
      {form}
    </>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HabitFormFields", () => {
  it("asks how often the habit is due, every day to start with", async () => {
    render(<Harness />);
    const often = screen.getByRole("spinbutton", { name: "How often" });
    expect(often).toHaveValue(1);
    await userEvent.clear(often);
    await userEvent.type(often, "2");
    expect(screen.getByTestId("period")).toHaveTextContent(
      JSON.stringify({ every: 2, unit: "day" }),
    );
  });

  it("draws the sets mode toggle's mark, off and on", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const off = screen.getByRole("button", { name: "Enable sets mode" });
    expect(off.querySelector("svg")).not.toBeNull();
    await user.click(off);
    const on = screen.getByRole("button", { name: "Sets mode ON" });
    expect(on.querySelector("svg")).not.toBeNull();
  });

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
    expect(screen.queryByRole("combobox", { name: "Unit" })).not.toBeNull(); // unit select still present
    await user.click(screen.getByRole("button", { name: /\+ Add/i }));
    // metric chip shows the reps-based badge, not "lbs"
    expect(screen.getByText("SETS · reps")).toBeInTheDocument();
  });

  describe("custom unit", () => {
    async function openCustomUnit(user: ReturnType<typeof userEvent.setup>) {
      await user.selectOptions(
        screen.getByRole("combobox", { name: "Unit" }),
        "+ Custom...",
      );
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
      expect(screen.getByRole("combobox", { name: "Unit" })).toHaveValue(
        "laps",
      );

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

  describe("group", () => {
    type User = ReturnType<typeof userEvent.setup>;
    const groupMenu = () => screen.getByRole("button", { name: /^Group:/ });
    const chosen = () => screen.getByTestId("group").textContent;
    /** The menu's options, opened and shut again. */
    async function offered(user: User) {
      await user.click(groupMenu());
      const options = within(
        screen.getByRole("listbox", { name: "Group" }),
      ).getAllByRole("option");
      await user.keyboard("{Escape}");
      return options;
    }
    async function choose(user: User, name: string) {
      await user.click(groupMenu());
      await user.click(screen.getByRole("option", { name }));
    }
    const openNewGroup = (user: User) => choose(user, "+ New group…");

    it("offers no group, each group with its icon, and a new one", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      expect(groupMenu()).toHaveAccessibleName("Group: None");
      const options = await offered(user);
      expect(options.map((o) => o.textContent)).toEqual([
        "None",
        "Music",
        "Fitness",
        "+ New group…",
      ]);
      // Each option's icon, ahead of its name
      const iconOf = (o: HTMLElement) =>
        o.firstElementChild!.querySelector("svg");
      expect(options.map((o) => !!iconOf(o))).toEqual([
        false,
        true,
        true,
        false,
      ]);
    });

    it("puts the habit in the chosen group, or in none", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await choose(user, "Fitness");
      expect(chosen()).toBe("g2");
      expect(groupMenu()).toHaveAccessibleName("Group: Fitness");
      await choose(user, "None");
      expect(chosen()).toBe("");
    });

    it("adds a new group from the menu and puts the habit in it", async () => {
      const user = userEvent.setup();
      const onAddGroup = vi.fn();
      render(<Harness onAddGroup={onAddGroup} />);
      await openNewGroup(user);
      await user.type(
        screen.getByRole("textbox", { name: "Group name" }),
        "Languages",
      );
      await user.click(screen.getByRole("button", { name: "Add Group" }));

      expect(onAddGroup).toHaveBeenCalledWith({
        id: expect.any(String),
        name: "Languages",
        icon: "folder",
        collapsed: false,
      });
      const { id } = onAddGroup.mock.calls[0][0];
      expect(chosen()).toBe(id);
      expect(groupMenu()).toHaveAccessibleName("Group: Languages");
      expect(screen.queryByRole("textbox", { name: "Group name" })).toBeNull();
    });

    it("gives a new group the icon picked for it", async () => {
      const user = userEvent.setup();
      const onAddGroup = vi.fn();
      render(<Harness onAddGroup={onAddGroup} />);
      await openNewGroup(user);
      const picker = screen.getByRole("group", { name: "Group icon" });
      expect(
        within(picker)
          .getAllByRole("button")
          .map((b) => b.getAttribute("aria-label")),
      ).toEqual(ICON_IDS.map((id) => ICON_NAMES[id]));
      expect(
        within(picker).getByRole("button", { pressed: true }),
      ).toHaveAccessibleName("Folder");
      await user.click(within(picker).getByRole("button", { name: "Work" }));
      await user.type(
        screen.getByRole("textbox", { name: "Group name" }),
        "Work",
      );
      await user.click(screen.getByRole("button", { name: "Add Group" }));
      expect(onAddGroup.mock.calls[0][0].icon).toBe("work");
    });

    it("starts the next new group from the default icon", async () => {
      const user = userEvent.setup();
      const onAddGroup = vi.fn();
      render(<Harness onAddGroup={onAddGroup} />);
      await openNewGroup(user);
      const picker = () => screen.getByRole("group", { name: "Group icon" });
      await user.click(within(picker()).getByRole("button", { name: "Work" }));
      await user.type(
        screen.getByRole("textbox", { name: "Group name" }),
        "Work",
      );
      await user.click(screen.getByRole("button", { name: "Add Group" }));
      await openNewGroup(user);
      expect(
        within(picker()).getByRole("button", { pressed: true }),
      ).toHaveAccessibleName("Folder");
    });

    it("won't add a group without a name", async () => {
      const user = userEvent.setup();
      render(<Harness />);
      await openNewGroup(user);
      const add = screen.getByRole("button", { name: "Add Group" });
      expect(add).toBeDisabled();
      await user.type(
        screen.getByRole("textbox", { name: "Group name" }),
        "  ",
      );
      expect(add).toBeDisabled();
    });

    it("closes without adding on Cancel, keeping the group chosen before", async () => {
      const user = userEvent.setup();
      const onAddGroup = vi.fn();
      render(<Harness onAddGroup={onAddGroup} />);
      await choose(user, "Music");
      await openNewGroup(user);
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onAddGroup).not.toHaveBeenCalled();
      expect(groupMenu()).toHaveAccessibleName("Group: Music");
      expect(chosen()).toBe("g1");
    });

    it("offers just None and a new group when there are no groups", async () => {
      const user = userEvent.setup();
      render(<Harness initialGroups={[]} />);
      const options = await offered(user);
      expect(options.map((o) => o.textContent)).toEqual([
        "None",
        "+ New group…",
      ]);
    });
  });
});
