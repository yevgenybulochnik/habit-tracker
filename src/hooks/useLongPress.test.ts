import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLongPress, type LongPressHandlers } from "./useLongPress";

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(options?: Parameters<typeof useLongPress>[1]) {
  const onLongPress = vi.fn();
  const hook = renderHook(({ cb, opts }) => useLongPress(cb, opts), {
    initialProps: { cb: onLongPress, opts: options },
  });
  const fire = (
    name: Exclude<keyof LongPressHandlers, "onClickCapture">,
    event = touchAt(0, 0),
  ) => act(() => hook.result.current.handlers[name](event));
  /** Click the element, returning whether the click was stopped. */
  const click = () => {
    const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
    act(() => hook.result.current.handlers.onClickCapture(event));
    return event.stopPropagation.mock.calls.length > 0;
  };
  return { onLongPress, hook, fire, click };
}

/** A touch event's parts the hook reads, with a finger at (x, y). */
function touchAt(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }], preventDefault: vi.fn() };
}

describe("useLongPress", () => {
  it.each(["onMouseDown", "onTouchStart"] as const)(
    "fires after holding for 500ms from %s",
    (start) => {
      const { onLongPress, hook, fire } = setup();
      fire(start);
      expect(hook.result.current.pressing).toBe(true);

      advance(499);
      expect(onLongPress).not.toHaveBeenCalled();

      advance(1);
      expect(onLongPress).toHaveBeenCalledOnce();
      expect(hook.result.current.pressing).toBe(false);
    },
  );

  it.each([
    "onMouseUp",
    "onMouseLeave",
    "onTouchEnd",
    "onTouchCancel",
  ] as const)("is cancelled by %s before the delay", (end) => {
    const { onLongPress, hook, fire } = setup();
    fire("onMouseDown");
    advance(300);
    fire(end);
    expect(hook.result.current.pressing).toBe(false);

    advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("takes a custom delay", () => {
    const { onLongPress, fire } = setup({ delay: 200 });
    fire("onMouseDown");
    advance(200);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const { onLongPress, hook, fire } = setup({ disabled: true });
    fire("onMouseDown");
    expect(hook.result.current.pressing).toBe(false);
    advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("restarts the wait when pressed again without a release", () => {
    const { onLongPress, fire } = setup();
    fire("onTouchStart");
    advance(300);
    fire("onMouseDown");
    advance(300);
    expect(onLongPress).not.toHaveBeenCalled();
    advance(200);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("is cancelled when the finger moves more than 10px", () => {
    const { onLongPress, hook, fire } = setup();
    fire("onTouchStart", touchAt(100, 100));
    fire("onTouchMove", touchAt(100, 111));
    expect(hook.result.current.pressing).toBe(false);
    advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("isn't cancelled by a finger wobbling in place", () => {
    const { onLongPress, fire } = setup();
    fire("onTouchStart", touchAt(100, 100));
    fire("onTouchMove", touchAt(106, 92));
    advance(500);
    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("stops the release after a hold from tapping what's under the finger", () => {
    const { fire } = setup();
    fire("onTouchStart");
    advance(500);
    const release = touchAt(0, 0);
    fire("onTouchEnd", release);
    expect(release.preventDefault).toHaveBeenCalled();
  });

  it("stops the click after a mouse hold, and only that click", () => {
    const { fire, click } = setup();
    fire("onMouseDown");
    advance(500);
    fire("onMouseUp");
    expect(click()).toBe(true);
    expect(click()).toBe(false);

    fire("onMouseDown");
    advance(200);
    fire("onMouseUp");
    expect(click()).toBe(false);
  });

  it("leaves the release of a short tap alone", () => {
    const { fire } = setup();
    fire("onTouchStart");
    advance(200);
    const release = touchAt(0, 0);
    fire("onTouchEnd", release);
    expect(release.preventDefault).not.toHaveBeenCalled();

    // Nor does a hold carry over to the next tap.
    fire("onTouchStart");
    advance(500);
    fire("onTouchEnd");
    fire("onTouchStart");
    const next = touchAt(0, 0);
    fire("onTouchEnd", next);
    expect(next.preventDefault).not.toHaveBeenCalled();
  });

  it("calls the latest callback", () => {
    const { onLongPress, hook, fire } = setup();
    const latest = vi.fn();
    fire("onMouseDown");
    hook.rerender({ cb: latest, opts: undefined });
    advance(500);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it("clears its timer when unmounted", () => {
    const { onLongPress, hook, fire } = setup();
    fire("onMouseDown");
    expect(vi.getTimerCount()).toBe(1);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
