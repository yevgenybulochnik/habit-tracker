import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { loadState, saveState } from "./lib/storage";

vi.mock("./lib/storage", () => ({
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
});
