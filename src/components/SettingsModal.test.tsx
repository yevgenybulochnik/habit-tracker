import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
      onClose={vi.fn()}
    />,
  );
  return { onImportState };
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

  it("imports a valid backup file", async () => {
    const { onImportState } = renderModal();
    await importFile(JSON.stringify(sample));
    await waitFor(() => expect(onImportState).toHaveBeenCalledWith(sample));
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
