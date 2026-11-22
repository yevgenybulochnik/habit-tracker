import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageShell, { PageHeader } from "./PageShell";

describe("PageShell", () => {
  it("heads its content with its title and subtitle", () => {
    render(
      <PageShell
        title="New Habit"
        subtitle="Tracked from today"
        onBack={vi.fn()}
      >
        <p>The form</p>
      </PageShell>,
    );
    expect(
      screen.getByRole("heading", { name: "New Habit", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tracked from today")).toBeInTheDocument();
    expect(screen.getByText("The form")).toBeInTheDocument();
  });

  it("goes back to the habits", async () => {
    const onBack = vi.fn();
    render(
      <PageShell title="New Habit" onBack={onBack}>
        <p>The form</p>
      </PageShell>,
    );
    await userEvent.click(screen.getByTitle("Back to habits"));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("PageHeader", () => {
  it("names where its back button goes, and has room for an action", async () => {
    const onBack = vi.fn();
    render(
      <PageHeader title="Edit routine" backTo="routines" onBack={onBack}>
        <button>Act</button>
      </PageHeader>,
    );
    await userEvent.click(screen.getByTitle("Back to routines"));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });
});
