import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ModalShell, { CLOSE_MS } from "./ModalShell";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** A modal with a plain Cancel and a "Delete" that acts once it's closed. */
function renderModal() {
  const onClose = vi.fn();
  const onDelete = vi.fn();
  const view = render(
    <ModalShell onClose={onClose}>
      {(requestClose) => (
        <>
          <h2>Title</h2>
          <button onClick={() => requestClose()}>Cancel</button>
          <button
            onClick={() =>
              requestClose(() => {
                // runs before onClose
                expect(onClose).not.toHaveBeenCalled();
                onDelete();
              })
            }
          >
            Delete
          </button>
        </>
      )}
    </ModalShell>,
  );
  return { onClose, onDelete, ...view };
}
const dialog = () => screen.getByRole("dialog");

describe("ModalShell", () => {
  it("shows its content in a dialog", () => {
    renderModal();
    expect(dialog()).toHaveTextContent("Title");
  });

  it("calls onClose once the close animation has run", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    advance(CLOSE_MS - 1);
    expect(onClose).not.toHaveBeenCalled();
    advance(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the backdrop is clicked, but not the dialog", () => {
    const { onClose } = renderModal();
    fireEvent.click(dialog());
    advance(CLOSE_MS);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(dialog().parentElement!);
    advance(CLOSE_MS);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("runs a follow-up action, then onClose, once closed", () => {
    const { onClose, onDelete } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    advance(CLOSE_MS);
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes only once when asked again while closing", () => {
    const { onClose, onDelete } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    advance(100);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(dialog().parentElement!);
    advance(CLOSE_MS);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("gives the CSS the same duration as its timer", () => {
    renderModal();
    expect(
      dialog().parentElement!.style.getPropertyValue("--modal-close-ms"),
    ).toBe(`${CLOSE_MS}ms`);
  });

  it("clears its timer when unmounted mid-close", () => {
    const { onClose, unmount } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });
});
