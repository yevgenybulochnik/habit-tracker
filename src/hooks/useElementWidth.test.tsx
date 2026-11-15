import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useElementWidth } from "./useElementWidth";

/** Records the observer the hook makes, so a test can report sizes to it. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(public callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}

const observer = () => {
  expect(FakeResizeObserver.instances).toHaveLength(1);
  return FakeResizeObserver.instances[0];
};

/** Report a new content width, as the browser would. */
const resize = (width: number) =>
  act(() => {
    const ro = observer();
    ro.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      ro as unknown as ResizeObserver,
    );
  });

/** The width the element has when it mounts. */
const mountWidth = (width: number) =>
  vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ width } as DOMRect);

function Probe() {
  const [ref, width] = useElementWidth<HTMLDivElement>(400);
  return (
    <div ref={ref} data-testid="box">
      {width}
    </div>
  );
}
const width = () => Number(screen.getByTestId("box").textContent);

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useElementWidth", () => {
  it("measures the element when it mounts", () => {
    mountWidth(352);
    render(<Probe />);
    expect(width()).toBe(352);
  });

  it("starts at the initial width while the element has none", () => {
    mountWidth(0);
    render(<Probe />);
    expect(width()).toBe(400);
  });

  it("observes the element and follows its resizes", () => {
    mountWidth(352);
    render(<Probe />);
    expect(observer().observed).toEqual([screen.getByTestId("box")]);

    resize(300);
    expect(width()).toBe(300);
  });

  // A hidden (display: none) element reports 0. Keeping the last real width
  // means showing it again doesn't change the width and re-run what uses it.
  it("ignores zero widths", () => {
    mountWidth(352);
    render(<Probe />);
    resize(0);
    expect(width()).toBe(352);
  });

  it("disconnects when unmounted", () => {
    mountWidth(352);
    const { unmount } = render(<Probe />);
    unmount();
    expect(observer().disconnected).toBe(true);
  });
});
