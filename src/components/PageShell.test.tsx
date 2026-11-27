import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PageShell, { PageHeader } from "./PageShell";
import { PageBackWrapper, back } from "../test/pageBack";

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

  it("has no back button: its way back is the pearl's", () => {
    const onBack = vi.fn();
    render(
      <PageShell title="New Habit" onBack={onBack}>
        <p>The form</p>
      </PageShell>,
      { wrapper: PageBackWrapper },
    );
    expect(screen.queryByRole("button")).toBeNull();
    back();
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe("PageHeader", () => {
  it("has room for an action", () => {
    render(
      <PageHeader title="Routines" onBack={vi.fn()}>
        <button>Act</button>
      </PageHeader>,
    );
    expect(screen.getByRole("button", { name: "Act" })).toBeInTheDocument();
  });

  it("gives the pearl the way back from the page on top", () => {
    const toHabits = vi.fn();
    const toList = vi.fn();
    const { rerender } = render(
      <>
        <PageHeader title="Routines" onBack={toHabits} />
        <PageHeader title="Edit routine" onBack={toList} />
      </>,
      { wrapper: PageBackWrapper },
    );
    back();
    expect(toList).toHaveBeenCalledOnce();
    expect(toHabits).not.toHaveBeenCalled();

    rerender(<PageHeader title="Routines" onBack={toHabits} />);
    back();
    expect(toHabits).toHaveBeenCalledOnce();
  });

  it("goes back the latest way it was given", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <PageHeader title="Settings" onBack={first} />,
      {
        wrapper: PageBackWrapper,
      },
    );
    rerender(<PageHeader title="Settings" onBack={second} />);
    back();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
});
