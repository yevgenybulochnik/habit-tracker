import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsModal from "./SettingsModal";
import { BUILTIN_UNITS, DEFAULT_CONFIG } from "../constants";
import type { PersistedState } from "../types";

const sample: PersistedState = {
  habits: [{ id: "h1", name: "Run", emoji: "🏃", color: "Green", metrics: [{ id: "m1", name: "Min", unit: "min" }] }],
  logs: { h1: { "2026-05-24": { m1: 30 } } },
  units: BUILTIN_UNITS,
  config: DEFAULT_CONFIG,
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

beforeEach(() => {
  // jsdom does not implement these
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => "blob:mock");
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn();
});

describe("SettingsModal — Data backup", () => {
  it("exports a JSON download when Export is clicked", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderModal();
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("imports a valid backup file", async () => {
    const user = userEvent.setup();
    const { onImportState } = renderModal();
    const file = new File([JSON.stringify(sample)], "backup.json", { type: "application/json" });
    await user.upload(screen.getByLabelText(/Import backup file/i), file);
    await waitFor(() => expect(onImportState).toHaveBeenCalledWith(sample));
  });

  it("shows an error for a malformed file and does not import", async () => {
    const user = userEvent.setup();
    const { onImportState } = renderModal();
    const file = new File(["not json {"], "bad.json", { type: "application/json" });
    await user.upload(screen.getByLabelText(/Import backup file/i), file);
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
        units={BUILTIN_UNITS} habits={sample.habits} logs={sample.logs}
        onUpdateUnit={vi.fn()} onDeleteUnit={vi.fn()} onAddUnit={vi.fn()}
        appConfig={DEFAULT_CONFIG} onUpdateConfig={onUpdateConfig}
        onImportState={vi.fn()} onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(onUpdateConfig).toHaveBeenCalledWith(expect.objectContaining({ theme: "light" }));
  });
});
