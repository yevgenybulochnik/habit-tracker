import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { InvalidDataError, loadState, saveState } from "./lib/storage";
import { captureDownloads } from "./test/downloads";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "./lib/defaults";
import { SCHEMA_VERSION } from "./lib/normalize";
import type { Habit, PersistedState } from "./types";

vi.mock("./lib/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/storage")>()),
  requestPersistence: vi.fn(async () => {}),
  loadState: vi.fn(),
  saveState: vi.fn(async () => {}),
}));

const mockLoad = vi.mocked(loadState);
const mockSave = vi.mocked(saveState);

beforeEach(() => {
  mockLoad.mockReset();
  mockSave.mockReset();
  mockSave.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App load errors", () => {
  it("shows the error screen and never saves when loading fails", async () => {
    mockLoad.mockRejectedValue(new Error("IDB is broken"));
    render(<App />);

    expect(
      await screen.findByText(/Couldn't open your data/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing was changed/i)).toBeInTheDocument();
    // The normal (empty) dashboard must not render — it would let a change
    // save an empty state over the real data.
    expect(screen.queryByText(/No habits yet/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /New Habit/i }),
    ).not.toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("Retry loads again and opens the app once it succeeds", async () => {
    mockLoad.mockRejectedValueOnce(new Error("IDB is broken"));
    mockLoad.mockResolvedValueOnce(null);
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Retry/i }),
    );

    expect(await screen.findByText(/No habits yet/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Couldn't open your data/i),
    ).not.toBeInTheDocument();
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("offers no raw-data download when the data couldn't be read at all", async () => {
    mockLoad.mockRejectedValue(new Error("IDB is broken"));
    render(<App />);

    await screen.findByText(/Couldn't open your data/i);
    expect(
      screen.queryByRole("button", { name: /Download raw data/i }),
    ).not.toBeInTheDocument();
  });
});

describe("App with stored data it can't normalize", () => {
  const raw = { habits: "none", logs: { h1: { "2026-05-24": { m1: 30 } } } };

  it("shows the error screen with the reason and never saves", async () => {
    mockLoad.mockRejectedValue(
      new InvalidDataError("habits is not a list", raw),
    );
    render(<App />);

    expect(
      await screen.findByText(/Couldn't open your data/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/habits is not a list/i)).toBeInTheDocument();
    expect(screen.queryByText(/No habits yet/i)).not.toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("downloads the raw data from the error screen", async () => {
    const downloads = captureDownloads();
    mockLoad.mockRejectedValue(
      new InvalidDataError("habits is not a list", raw),
    );
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /Download raw data/i }),
    );

    const files = await downloads.files();
    expect(files).toHaveLength(1);
    expect(files[0].name).toMatch(/^habit-tracker-raw-data-.*\.json$/);
    expect(JSON.parse(files[0].text)).toEqual(raw);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("drops the download once a retry succeeds", async () => {
    mockLoad.mockRejectedValueOnce(
      new InvalidDataError("habits is not a list", raw),
    );
    mockLoad.mockRejectedValueOnce(new Error("IDB is broken"));
    render(<App />);

    await screen.findByRole("button", { name: /Download raw data/i });
    await userEvent.click(screen.getByRole("button", { name: /Retry/i }));

    expect(await screen.findByText(/IDB is broken/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Download raw data/i }),
    ).not.toBeInTheDocument();
  });
});

describe("App saves", () => {
  const km = {
    id: "km",
    label: "Km",
    quickAdd: [1, 5],
    thresholds: [2, 5, 10],
  };
  const loaded: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    habits: [],
    logs: { gone: { "2026-05-24": { m1: 30 } } },
    units: [...BUILTIN_UNITS, km],
    config: { ...DEFAULT_CONFIG, numMonths: 6, theme: "light" },
    groups: [],
    routines: [],
    timers: { "gone:m1": 1_700_000_000_000 },
  };

  async function switchToTheme(theme: "Light" | "Dark") {
    await userEvent.click(await screen.findByTitle("Settings"));
    await userEvent.click(screen.getByRole("button", { name: theme }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    return mockSave.mock.lastCall![0];
  }

  it("writes the schema version with every save", async () => {
    mockLoad.mockResolvedValue(null);
    render(<App />);

    expect((await switchToTheme("Light")).schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("saves a change on top of what was loaded", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    expect(await switchToTheme("Dark")).toEqual({
      ...loaded,
      config: { ...loaded.config, theme: "dark" },
    });
  });
});

describe("App changes to habits", () => {
  const run: Habit = {
    id: "h1",
    name: "Run",
    emoji: "🏃",
    color: "Green",
    metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
    intensityMode: "total",
  };
  const loaded: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    habits: [run],
    logs: { h1: { "2026-05-23": { m1: 30 } } },
    units: BUILTIN_UNITS,
    config: DEFAULT_CONFIG,
    groups: [],
    routines: [],
  };
  const lastSaved = () => mockSave.mock.lastCall![0];

  beforeEach(() => {
    // Only the date is faked: Date.now stays put until a test moves it
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 4, 24, 10, 0));
    // A habit card measures its width, which jsdom can't do
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup(); // unmount while the ResizeObserver stub is still there
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("doesn't save what it has only just loaded", async () => {
    // Strict mode loads twice and abandons the first load. Here that one
    // finishes last, which mustn't count as a change either.
    let finishFirstLoad!: (s: PersistedState) => void;
    mockLoad.mockImplementationOnce(
      () => new Promise((resolve) => (finishFirstLoad = resolve)),
    );
    mockLoad.mockResolvedValue(loaded);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(await screen.findByText("0/1 completed today")).toBeInTheDocument();
    await act(async () => finishFirstLoad(loaded));
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("opens Settings on a page of its own, and Done comes back", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    await userEvent.click(await screen.findByTitle("Settings"));
    expect(
      screen.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("heading", { name: "Settings" })).toBeNull();
  });

  it("makes a new habit on a page of its own, in place of the habits", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /New Habit/i }),
    );
    expect(
      screen.getByRole("heading", { name: "New Habit", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByTitle("Back to habits"));
    expect(screen.queryByRole("heading", { name: "New Habit" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Run", level: 3 }),
    ).toBeInTheDocument();
  });

  it("adds a habit with an id of its own and no logs", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /New Habit/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Morning Workout/i),
      "Read",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    const { habits, logs } = lastSaved();
    expect(habits.map((h) => h.name)).toEqual(["Run", "Read"]);
    const id = habits[1].id;
    expect(id).toMatch(/^h_/);
    expect(logs).toEqual({ ...loaded.logs, [id]: {} });
  });

  it("adds a habit into a group made in its form", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: /New Habit/i }),
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Morning Workout/i),
      "Spanish",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Group" }),
      "+ New group…",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Group name" }),
      "Languages",
    );
    await userEvent.click(screen.getByRole("button", { name: "Add Group" }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(lastSaved().habits).toHaveLength(2));
    const { groups, habits } = lastSaved();
    expect(groups).toEqual([
      {
        id: expect.any(String),
        name: "Languages",
        emoji: "📁",
        collapsed: false,
      },
    ]);
    expect(habits[1].groupId).toBe(groups[0].id);
  });

  it("edits a habit on a page of its own, held from its card", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    fireEvent.mouseDown(await screen.findByText("Run"));
    expect(
      await screen.findByRole(
        "heading",
        { name: "Edit Habit", level: 1 },
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Delete habit" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Habit" }));
    await waitFor(() => expect(lastSaved().habits).toEqual([]));
    expect(screen.queryByRole("heading", { name: "Edit Habit" })).toBeNull();
  });

  it("moves a habit to another group, or to none, from its editor", async () => {
    mockLoad.mockResolvedValue({
      ...loaded,
      habits: [{ ...run, groupId: "g2" }],
      groups: [
        { id: "g1", name: "Music", emoji: "🎵", collapsed: false },
        { id: "g2", name: "Fitness", emoji: "🏋️", collapsed: false },
      ],
    });
    render(<App />);
    const editRun = async () => {
      fireEvent.mouseDown(await screen.findByText("Run"));
      await screen.findByText("Edit Habit", undefined, { timeout: 2000 });
    };

    await editRun();
    const menu = screen.getByRole("combobox", { name: "Group" });
    expect(menu).toHaveValue("g2");
    await userEvent.selectOptions(menu, "🎵 Music");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(lastSaved().habits[0].groupId).toBe("g1"));

    await waitFor(() => expect(screen.queryByText("Edit Habit")).toBeNull());
    await editRun();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Group" }),
      "None",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(lastSaved().habits[0]).not.toHaveProperty("groupId"),
    );
  });

  it("saves a running timer, and logs its minutes to today when stopped", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);
    const start = Date.now();

    await userEvent.click(await screen.findByRole("button", { name: /Timer/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(lastSaved().timers).toEqual({ "h1:m1": start });

    vi.setSystemTime(start + 12 * 60_000 + 20_000);
    await userEvent.click(screen.getByRole("button", { name: /Stop/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(2));
    expect(lastSaved().timers).toEqual({});
    expect(lastSaved().logs.h1).toEqual({
      "2026-05-23": { m1: 30 },
      "2026-05-24": { m1: 12 },
    });
  });
});

describe("App groups", () => {
  const habit = (id: string, name: string, groupId?: string): Habit => ({
    id,
    name,
    emoji: "🎯",
    color: "Green",
    metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
    intensityMode: "total",
    ...(groupId && { groupId }),
  });
  const grouped: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    habits: [
      habit("h1", "Piano", "g1"),
      habit("h2", "Water"),
      habit("h3", "Run", "g2"),
    ],
    logs: {},
    units: BUILTIN_UNITS,
    config: DEFAULT_CONFIG,
    groups: [
      { id: "g1", name: "Music", emoji: "🎵", collapsed: false },
      { id: "g2", name: "Fitness", emoji: "🏋️", collapsed: false },
    ],
    routines: [],
  };

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows each group's section, under the habits in no group", async () => {
    mockLoad.mockResolvedValue(grouped);
    render(<App />);

    const music = await screen.findByRole("region", { name: "Music" });
    expect(music).toHaveTextContent("Piano");
    expect(screen.getByRole("region", { name: "Fitness" })).toHaveTextContent(
      "Run",
    );
    const water = screen.getByText("Water");
    expect(
      water.compareDocumentPosition(music) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Groups" }),
    ).toBeInTheDocument();
  });

  it("shows the plain list, with no group bar, while there are no groups", async () => {
    mockLoad.mockResolvedValue({
      ...grouped,
      habits: grouped.habits.map(({ groupId: _, ...h }) => h),
      groups: [],
    });
    render(<App />);

    expect(await screen.findByText("Piano")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Groups" })).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("offers Reorder for two groups, even with one habit", async () => {
    mockLoad.mockResolvedValue({
      ...grouped,
      habits: [habit("h1", "Piano", "g1")],
    });
    render(<App />);
    expect(
      await screen.findByRole("button", { name: /Reorder/ }),
    ).toBeInTheDocument();
  });

  /** Hold `el` until the group editor opens. */
  async function holdToEdit(el: HTMLElement) {
    fireEvent.mouseDown(el);
    await screen.findByText("Edit Group", undefined, { timeout: 2000 });
  }

  it("renames a group and changes its habits from its editor", async () => {
    mockLoad.mockResolvedValue(grouped);
    render(<App />);

    const nav = await screen.findByRole("navigation", { name: "Groups" });
    await holdToEdit(within(nav).getByRole("button", { name: /Music/ }));
    const name = screen.getByRole("textbox", { name: "Group name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Practice");
    await userEvent.click(screen.getByRole("checkbox", { name: /Water/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockSave.mock.lastCall![0].habits[1].groupId).toBe("g1"),
    );
    const { groups, habits } = mockSave.mock.lastCall![0];
    expect(groups[0].name).toBe("Practice");
    expect(habits.map((h) => h.groupId)).toEqual(["g1", "g1", "g2"]);
  });

  it("deletes a group from its editor, keeping its habits", async () => {
    mockLoad.mockResolvedValue(grouped);
    render(<App />);

    const music = await screen.findByRole("region", { name: "Music" });
    await holdToEdit(within(music).getByRole("button", { name: /Music/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete group" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Group" }));

    await waitFor(() =>
      expect(mockSave.mock.lastCall![0].groups).toEqual([grouped.groups[1]]),
    );
    const { habits } = mockSave.mock.lastCall![0];
    expect(habits.map((h) => h.name)).toEqual(["Piano", "Water", "Run"]);
    expect(habits[0]).not.toHaveProperty("groupId");
    expect(screen.queryByRole("region", { name: "Music" })).toBeNull();
  });

  it("saves a section folded shut", async () => {
    mockLoad.mockResolvedValue(grouped);
    render(<App />);

    const music = await screen.findByRole("region", { name: "Music" });
    await userEvent.click(within(music).getByRole("button", { name: /Music/ }));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.lastCall![0].groups[0].collapsed).toBe(true);
  });
});

describe("App at midnight", () => {
  const loaded: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    habits: [
      {
        id: "h1",
        name: "Run",
        emoji: "🏃",
        color: "Green",
        metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
        intensityMode: "total",
      },
    ],
    logs: { h1: { "2026-05-24": { m1: 30 } } },
    units: BUILTIN_UNITS,
    config: DEFAULT_CONFIG,
    groups: [],
    routines: [],
  };

  beforeEach(() => {
    // The fake clock keeps ticking in real time, because findBy and waitFor
    // wait on timeouts of their own. Midnight is a minute away, so it only
    // arrives when a test advances the clock.
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout"],
      shouldAdvanceTime: true,
    });
    vi.setSystemTime(new Date(2026, 4, 24, 23, 59));
    // A habit card measures its width, which jsdom can't do
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup(); // unmount while the ResizeObserver stub is still there
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Shown by the quick-log section only when today has a value
  const resetButton = () => screen.queryByRole("button", { name: "↺" });

  /** Advance the clock past midnight; the app follows on its next frame. */
  async function passMidnight() {
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(await screen.findByText("0/1 completed today")).toBeInTheDocument();
  }

  it("moves on to the new day while the app stays open", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);

    expect(await screen.findByText("1/1 completed today")).toBeInTheDocument();
    expect(resetButton()).toBeInTheDocument();

    await passMidnight();

    expect(resetButton()).not.toBeInTheDocument();
  });

  it("logs to the new day after midnight", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);
    await screen.findByText("1/1 completed today");

    await passMidnight();
    fireEvent.click(screen.getByRole("button", { name: "+15" }));

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.lastCall![0].logs).toEqual({
      h1: { "2026-05-24": { m1: 30 }, "2026-05-25": { m1: 15 } },
    });
    expect(screen.getByText("1/1 completed today")).toBeInTheDocument();
    expect(resetButton()).toBeInTheDocument();
  });
});

describe("App backup import", () => {
  it("replaces the state with the backup, in the current format", async () => {
    mockLoad.mockResolvedValue(null);
    render(<App />);
    await userEvent.click(await screen.findByTitle("Settings"));

    // A backup from an older version: no schema version, units or config
    const backup = { habits: [], logs: { gone: { "2026-05-24": { m1: 30 } } } };
    await userEvent.upload(
      screen.getByLabelText(/Import backup file/i),
      new File([JSON.stringify(backup)], "backup.json", {
        type: "application/json",
      }),
    );

    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave.mock.lastCall![0]).toEqual({
      schemaVersion: SCHEMA_VERSION,
      habits: [],
      logs: backup.logs,
      units: BUILTIN_UNITS,
      config: DEFAULT_CONFIG,
      groups: [],
      routines: [],
      timers: {},
    });
  });
});

describe("App save errors", () => {
  // Changing the theme in Settings is a save that needs no habit cards (and so
  // no ResizeObserver stub in jsdom).
  async function changeTheme(theme: "Light" | "Dark") {
    await userEvent.click(screen.getByRole("button", { name: theme }));
  }

  const banner = () => screen.queryByText(/Changes aren't being saved/i);

  it("shows a persistent banner when a save fails", async () => {
    mockLoad.mockResolvedValue(null);
    mockSave.mockRejectedValue(new Error("QuotaExceededError"));
    render(<App />);
    await userEvent.click(await screen.findByTitle("Settings"));

    expect(banner()).not.toBeInTheDocument();
    await changeTheme("Light");

    expect(
      await screen.findByText(/Changes aren't being saved/i),
    ).toBeInTheDocument();
    expect(banner()).toHaveTextContent(/export a backup/i);
    expect(mockSave).toHaveBeenCalled();
  });

  it("clears the banner after the next successful save", async () => {
    mockLoad.mockResolvedValue(null);
    mockSave.mockRejectedValueOnce(new Error("QuotaExceededError"));
    render(<App />);
    await userEvent.click(await screen.findByTitle("Settings"));

    await changeTheme("Light");
    expect(
      await screen.findByText(/Changes aren't being saved/i),
    ).toBeInTheDocument();

    await changeTheme("Dark");
    await waitFor(() => expect(banner()).not.toBeInTheDocument());
    expect(mockSave).toHaveBeenCalledTimes(2);
  });
});

describe("App routines", () => {
  const plank: Habit = {
    id: "h1",
    name: "Plank",
    emoji: "🧘",
    color: "Green",
    metrics: [{ id: "m1", name: "Minutes", unit: "min" }],
    intensityMode: "total",
  };
  const loaded: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    habits: [plank],
    logs: {},
    units: BUILTIN_UNITS,
    config: DEFAULT_CONFIG,
    groups: [],
    routines: [
      {
        id: "r1",
        name: "Morning",
        rounds: 1,
        prep: 5,
        steps: [
          {
            kind: "habit",
            id: "s1",
            habitId: "h1",
            metricId: "m1",
            by: "time",
            seconds: 60,
            count: 10,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the Routines page from the header, over the habits, and back", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);
    await userEvent.click(await screen.findByTitle("Routines"));
    expect(
      screen.getByRole("heading", { name: "Routines" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Morning" })).toBeVisible();
    await userEvent.click(screen.getByTitle("Back to habits"));
    expect(screen.queryByRole("heading", { name: "Routines" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Plank", level: 3 }),
    ).toBeInTheDocument();
  });

  it("saves a routine with the rest of the data", async () => {
    mockLoad.mockResolvedValue(loaded);
    render(<App />);
    await userEvent.click(await screen.findByTitle("Routines"));
    await userEvent.click(screen.getByRole("button", { name: "Edit Morning" }));
    await userEvent.click(screen.getByRole("button", { name: "More rounds" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mockSave.mock.lastCall?.[0].routines[0].rounds).toBe(2),
    );
  });
});
