import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
