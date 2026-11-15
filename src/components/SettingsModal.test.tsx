import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsModal from "./SettingsModal";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "../lib/defaults";
import { SCHEMA_VERSION } from "../lib/normalize";
import { captureDownloads } from "../test/downloads";
import type { PersistedState } from "../types";

// Current-format state: what an export writes and an import hands back.
const sample: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  habits: [
    {
      id: "h1",
      name: "Run",
      emoji: "🏃",
      color: "Green",
      metrics: [{ id: "m1", name: "Min", unit: "min" }],
      intensityMode: "total",
    },
  ],
  logs: { h1: { "2026-05-24": { m1: 30 } } },
  units: BUILTIN_UNITS,
  config: DEFAULT_CONFIG,
};

// The same state as a backup from an older version: no schema version,
// intensity mode, units or config.
const oldBackup = {
  habits: [
    {
      id: "h1",
      name: "Run",
      emoji: "🏃",
      color: "Green",
      metrics: [{ id: "m1", name: "Min", unit: "min" }],
    },
  ],
  logs: { h1: { "2026-05-24": { m1: 30 } } },
};

function renderModal(onImportState = vi.fn()) {
  const onClose = vi.fn();
  render(
    <SettingsModal
      units={BUILTIN_UNITS}
      habits={sample.habits}
      logs={sample.logs}
      onUpdateUnit={vi.fn()}
      onDeleteUnit={vi.fn()}
      onAddUnit={vi.fn()}
      appConfig={DEFAULT_CONFIG}
      onUpdateConfig={vi.fn()}
      onImportState={onImportState}
      onClose={onClose}
    />,
  );
  return { onImportState, onClose };
}

/** Pick `content` as the file to import. */
async function importFile(content: string) {
  const file = new File([content], "backup.json", { type: "application/json" });
  await userEvent.upload(screen.getByLabelText(/Import backup file/i), file);
}

let downloads: ReturnType<typeof captureDownloads>;

beforeEach(() => {
  downloads = captureDownloads();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsModal — Data backup", () => {
  it("exports the state, with its schema version, as a JSON download", async () => {
    renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Export" }));

    const files = await downloads.files();
    expect(files).toHaveLength(1);
    expect(files[0].name).toMatch(/^habit-tracker-backup-.*\.json$/);
    expect(JSON.parse(files[0].text)).toEqual(sample);
  });

  it("imports a valid backup file, then closes", async () => {
    const { onImportState, onClose } = renderModal();
    await importFile(JSON.stringify(sample));
    await waitFor(() => expect(onImportState).toHaveBeenCalledWith(sample));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("imports a backup from an older version in the current format", async () => {
    const { onImportState } = renderModal();
    await importFile(JSON.stringify(oldBackup));
    await waitFor(() => expect(onImportState).toHaveBeenCalledWith(sample));
  });

  it.each([
    ["a malformed file", "not json {"],
    ["JSON that isn't a backup", JSON.stringify({ name: "habit-tracker" })],
    ["a backup whose habits have no ids", '{"habits":[{"name":"Run"}]}'],
    [
      "a backup from a newer version",
      JSON.stringify({ ...sample, schemaVersion: SCHEMA_VERSION + 1 }),
    ],
  ])("shows an error for %s and does not import", async (_, content) => {
    const { onImportState } = renderModal();
    await importFile(content);
    expect(await screen.findByText(/valid backup file/i)).toBeInTheDocument();
    expect(onImportState).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // still open
  });
});

describe("SettingsModal — theme", () => {
  it("switches theme when a theme button is clicked", async () => {
    const user = userEvent.setup();
    const onUpdateConfig = vi.fn();
    render(
      <SettingsModal
        units={BUILTIN_UNITS}
        habits={sample.habits}
        logs={sample.logs}
        onUpdateUnit={vi.fn()}
        onDeleteUnit={vi.fn()}
        onAddUnit={vi.fn()}
        appConfig={DEFAULT_CONFIG}
        onUpdateConfig={onUpdateConfig}
        onImportState={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(onUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "light" }),
    );
  });
});

describe("SettingsModal — units", () => {
  function renderUnits() {
    const handlers = {
      onAddUnit: vi.fn(),
      onUpdateUnit: vi.fn(),
      onDeleteUnit: vi.fn(),
    };
    render(
      <SettingsModal
        units={BUILTIN_UNITS}
        habits={sample.habits}
        logs={sample.logs}
        appConfig={DEFAULT_CONFIG}
        onUpdateConfig={vi.fn()}
        onImportState={vi.fn()}
        onClose={vi.fn()}
        {...handlers}
      />,
    );
    return handlers;
  }
  const addPanel = () => screen.getByRole("region", { name: "Add New Unit" });

  it("adds a unit", async () => {
    const { onAddUnit } = renderUnits();
    const panel = within(addPanel());
    await userEvent.type(panel.getByLabelText("ID"), "cups");
    await userEvent.type(panel.getByLabelText("Label"), "Cups");
    await userEvent.click(panel.getByRole("button", { name: "Add Unit" }));
    expect(onAddUnit).toHaveBeenCalledWith({
      id: "cups",
      label: "Cups",
      quickAdd: [1, 5, 10],
      thresholds: [1, 3, 5],
    });
  });

  it("won't add a unit whose id is taken, and says so", async () => {
    const { onAddUnit } = renderUnits();
    const panel = within(addPanel());
    await userEvent.type(panel.getByLabelText("ID"), "reps");
    await userEvent.type(panel.getByLabelText("Label"), "Reps again");
    await userEvent.click(panel.getByRole("button", { name: "Add Unit" }));
    expect(panel.getByRole("alert")).toHaveTextContent(/already a unit/);
    expect(onAddUnit).not.toHaveBeenCalled();
  });

  it("edits a unit's thresholds", async () => {
    const { onUpdateUnit } = renderUnits();
    const reps = BUILTIN_UNITS.find((u) => u.id === "reps")!;
    await userEvent.click(screen.getByRole("button", { name: "Edit Reps" }));
    const row = within(
      screen.getByRole("group", { name: `Edit ${reps.label}` }),
    );
    expect(row.getByLabelText("ID")).toBeDisabled();

    await userEvent.clear(row.getByLabelText("Thresholds"));
    await userEvent.type(row.getByLabelText("Thresholds"), "20, 50, 100");
    await userEvent.click(row.getByRole("button", { name: "Save" }));
    expect(onUpdateUnit).toHaveBeenCalledWith("reps", {
      label: reps.label,
      quickAdd: reps.quickAdd,
      thresholds: [20, 50, 100],
    });
    expect(screen.queryByRole("group", { name: /^Edit/ })).toBeNull();
  });

  it("keeps editing, and saves nothing, while a field is invalid", async () => {
    const { onUpdateUnit } = renderUnits();
    await userEvent.click(screen.getByRole("button", { name: "Edit Minutes" }));
    const row = within(screen.getByRole("group", { name: "Edit Minutes" }));
    await userEvent.clear(row.getByLabelText("Label"));
    await userEvent.click(row.getByRole("button", { name: "Save" }));
    expect(row.getByRole("alert")).toHaveTextContent("Enter a label.");
    expect(onUpdateUnit).not.toHaveBeenCalled();
  });
});
